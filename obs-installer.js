// Installation des overlays dans OBS, via le serveur WebSocket intégré à OBS (v28 et plus, protocole v5).
// Tout se passe entre ce navigateur et OBS, sur le PC du streamer : le mot de passe OBS n'est
// envoyé nulle part ailleurs. Utilisé par installer.html (et testable dans Node).
'use strict';

(function (root) {
  /** Noms dans OBS. Relancer l'installation met à jour ces sources au lieu d'en créer d'autres. */
  const NAMES = {
    overlay: '📡 Overlay Event',
    scenes: {
      debut: ['📡 Event · Commence bientôt', '📡 Overlay Event · Commence bientôt'],
      pause: ['📡 Event · Pause', '📡 Overlay Event · Pause'],
      veille: ['📡 Event · En veille', '📡 Overlay Event · En veille'],
      fin: ['📡 Event · Fin du stream', '📡 Overlay Event · Fin du stream'],
    },
  };

  class InstallError extends Error {
    constructor(code, detail = '') {
      super(code);
      this.code = code;
      this.detail = detail;
    }
  }

  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const sha256b64 = async (text) => b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  /** Réponse au défi d'authentification d'OBS (protocole v5). */
  const authString = async (password, salt, challenge) => sha256b64((await sha256b64(password + salt)) + challenge);

  class ObsClient {
    constructor(url, WS = root.WebSocket) {
      this.url = url;
      this.WS = WS;
      this.pending = new Map();
      this.nextId = 1;
    }

    /** Se connecte et s'identifie. Erreurs : 'connexion', 'mot-de-passe', 'mot-de-passe-requis'. */
    connect(password = '') {
      return new Promise((resolve, reject) => {
        let ws;
        try {
          ws = new this.WS(this.url, 'obswebsocket.json');
        } catch {
          return reject(new InstallError('connexion'));
        }
        this.ws = ws;
        let identified = false;
        ws.onerror = () => { if (!identified) reject(new InstallError('connexion')); };
        ws.onclose = (ev) => {
          if (!identified) return reject(new InstallError(ev.code === 4009 ? 'mot-de-passe' : 'connexion'));
          for (const p of this.pending.values()) p.reject(new InstallError('connexion'));
          this.pending.clear();
        };
        ws.onmessage = async (ev) => {
          const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
          if (msg.op === 0) { // Hello
            const d = { rpcVersion: 1, eventSubscriptions: 0 };
            const auth = msg.d.authentication;
            if (auth) {
              if (!password) { reject(new InstallError('mot-de-passe-requis')); return ws.close(); }
              d.authentication = await authString(password, auth.salt, auth.challenge);
            }
            ws.send(JSON.stringify({ op: 1, d }));
          } else if (msg.op === 2) { // Identified
            identified = true;
            resolve(msg.d);
          } else if (msg.op === 7) { // RequestResponse
            const p = this.pending.get(msg.d.requestId);
            if (!p) return;
            this.pending.delete(msg.d.requestId);
            const st = msg.d.requestStatus;
            if (st.result) p.resolve(msg.d.responseData ?? {});
            else p.reject(Object.assign(new InstallError('obs', st.comment ?? ''), { obsCode: st.code }));
          }
        };
      });
    }

    request(requestType, requestData = {}) {
      return new Promise((resolve, reject) => {
        const requestId = String(this.nextId++);
        this.pending.set(requestId, { resolve, reject });
        this.ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
      });
    }

    close() { try { this.ws?.close(); } catch { /* déjà fermé */ } }
  }

  /** Adresse d'une source : site des overlays + clé + scène + options (coin, thème, son). */
  function sourceUrl(siteUrl, key, scene, options = {}) {
    const p = [`cle=${key}`];
    if (scene) p.push(`scene=${scene}`);
    if (options.coin && options.coin !== 'bg') p.push(`coin=${options.coin}`);
    if (options.theme === 'clair') p.push('theme=clair');
    if (options.son === false) p.push('son=0');
    return `${siteUrl}/#${p.join('&')}`;
  }

  /**
   * Installe (ou met à jour) les overlays.
   * @param {ObsClient} obs client connecté
   * @param {object} o
   * @param {string} o.siteUrl   site des overlays
   * @param {string} o.key       clé de l'overlay du streamer
   * @param {string[]} o.addTo   scènes existantes où ajouter l'overlay principal (en haut)
   * @param {boolean} o.scenes   créer les 4 scènes plein écran
   * @param {object} [o.options] { coin, theme, son }
   * @param {(line: string) => void} [log]
   */
  async function install(obs, { siteUrl, key, addTo = [], scenes = true, options = {} }, log = () => {}) {
    const video = await obs.request('GetVideoSettings');
    const W = video.baseWidth;
    const H = video.baseHeight;
    const settings = (url) => ({ url, width: 1920, height: 1080, reroute_audio: true, shutdown: false, restart_when_active: false });

    // La source remplit tout l'écran OBS, quelle que soit sa résolution, et passe au premier plan.
    const fitAndTop = async (sceneName, sceneItemId) => {
      await obs.request('SetSceneItemTransform', {
        sceneName, sceneItemId,
        sceneItemTransform: { boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsWidth: W, boundsHeight: H, boundsAlignment: 0, alignment: 5, positionX: 0, positionY: 0 },
      });
      const { sceneItems } = await obs.request('GetSceneItemList', { sceneName });
      await obs.request('SetSceneItemIndex', { sceneName, sceneItemId, sceneItemIndex: sceneItems.length - 1 });
    };

    /** Met la source dans la scène si elle n'y est pas déjà. */
    const ensureInScene = async (sceneName, sourceName) => {
      const { sceneItems } = await obs.request('GetSceneItemList', { sceneName });
      const found = sceneItems.find((i) => i.sourceName === sourceName);
      const id = found ? found.sceneItemId : (await obs.request('CreateSceneItem', { sceneName, sourceName, sceneItemEnabled: true })).sceneItemId;
      await fitAndTop(sceneName, id);
      return found ? 'déjà présent' : 'ajouté';
    };

    /** Crée la source navigateur, ou met à jour son adresse si elle existe déjà (réinstallation). */
    const upsert = async (sceneName, inputName, url) => {
      try {
        const r = await obs.request('CreateInput', { sceneName, inputName, inputKind: 'browser_source', inputSettings: settings(url), sceneItemEnabled: true });
        await fitAndTop(sceneName, r.sceneItemId);
        return 'créée';
      } catch (err) {
        if (err.obsCode !== 601) { // 601 : existe déjà
          if (err.obsCode === 605 || /kind/i.test(err.detail)) throw new InstallError('source-navigateur');
          throw err;
        }
        await obs.request('SetInputSettings', { inputName, inputSettings: settings(url) });
        await ensureInScene(sceneName, inputName);
        return 'mise à jour';
      }
    };

    const { scenes: existing } = await obs.request('GetSceneList');
    const sceneNames = new Set(existing.map((s) => s.sceneName));
    const done = { scenes: [], overlay: [] };

    if (scenes) {
      for (const [scene, [sceneName, inputName]] of Object.entries(NAMES.scenes)) {
        if (!sceneNames.has(sceneName)) {
          await obs.request('CreateScene', { sceneName });
          sceneNames.add(sceneName);
        }
        const what = await upsert(sceneName, inputName, sourceUrl(siteUrl, key, scene, options));
        log(`✓ Scène « ${sceneName.replace('📡 ', '')} » : source ${what}`);
        done.scenes.push(sceneName);
      }
    }

    const targets = addTo.filter((n) => sceneNames.has(n));
    for (const [i, sceneName] of targets.entries()) {
      const what = i === 0 ? await upsert(sceneName, NAMES.overlay, sourceUrl(siteUrl, key, null, options)) : await ensureInScene(sceneName, NAMES.overlay);
      log(`✓ Overlay dans « ${sceneName} » : ${what}`);
      done.overlay.push(sceneName);
    }
    // Overlay principal non ajouté ailleurs mais déjà présent : on met quand même son adresse à jour.
    if (!targets.length) {
      try {
        await obs.request('SetInputSettings', { inputName: NAMES.overlay, inputSettings: settings(sourceUrl(siteUrl, key, null, options)) });
        log('✓ Overlay principal existant : adresse mise à jour');
      } catch { /* pas encore créé : rien à faire */ }
    }
    return done;
  }

  root.ObsInstaller = { ObsClient, install, sourceUrl, authString, NAMES, InstallError };
})(typeof window !== 'undefined' ? window : globalThis);
