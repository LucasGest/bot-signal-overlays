// Installation des overlays dans OBS, via le serveur WebSocket intégré à OBS (v28 et plus, protocole v5).
// Tout se passe entre ce navigateur et OBS, sur le PC du streamer : le mot de passe OBS n'est
// envoyé nulle part ailleurs. Utilisé par installer.html (et testable dans Node).
'use strict';

(function (root) {
  /** Noms dans OBS. Relancer l'installation met à jour ces sources au lieu d'en créer d'autres. */
  const NAMES = {
    profile: '📡 Community Event',    // profil OBS à part (réglages techniques)
    collection: '📡 Community Event', // collection de scènes à part : la chaîne du streamer n'est jamais touchée
    live: '📡 Event · En live',       // scène de stream de l'event (overlay déjà dedans, le streamer ajoute jeu et webcam)
    overlay: '📡 Overlay Event',
    camFrame: '📡 Cadre webcam · Pause', // au-dessus de la webcam dans la scène Pause
    scenes: {
      debut: ['📡 Event · Commence bientôt', '📡 Overlay Event · Commence bientôt'],
      pause: ['📡 Event · Pause', '📡 Overlay Event · Pause'],
      veille: ['📡 Event · En veille', '📡 Overlay Event · En veille'],
      fin: ['📡 Event · Fin du stream', '📡 Overlay Event · Fin du stream'],
    },
  };

  /**
   * Réglages techniques recopiés dans le nouveau profil (mode de sortie simple et avancé, audio).
   * Jamais la clé de stream ni le compte connecté.
   */
  const PROFILE_PARAMS = [
    ['Output', 'Mode'],
    ['SimpleOutput', 'VBitrate'], ['SimpleOutput', 'ABitrate'], ['SimpleOutput', 'StreamEncoder'],
    ['SimpleOutput', 'Preset'], ['SimpleOutput', 'NVENCPreset2'], ['SimpleOutput', 'RecQuality'], ['SimpleOutput', 'RecFormat2'], ['SimpleOutput', 'FilePath'],
    ['AdvOut', 'Encoder'], ['AdvOut', 'RecEncoder'], ['AdvOut', 'TrackIndex'], ['AdvOut', 'RecFilePath'], ['AdvOut', 'RecFormat2'],
    ['Audio', 'SampleRate'], ['Audio', 'ChannelSetup'],
    ['Video', 'ScaleType'], ['Video', 'ColorFormat'], ['Video', 'ColorSpace'], ['Video', 'ColorRange'],
  ];

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

  /** Adresse d'une source : site des overlays + clé + scène + options (coin, thème, son, cadre webcam, bandeau, chat). */
  function sourceUrl(siteUrl, key, scene, options = {}) {
    const p = [`cle=${key}`];
    if (scene) p.push(`scene=${scene}`);
    if (options.coin && options.coin !== 'bg') p.push(`coin=${options.coin}`);
    if (options.theme === 'clair') p.push('theme=clair');
    if (options.son === false) p.push('son=0');
    if ((!scene || scene === 'pause') && options.cam === false) p.push('cam=0');
    if (!scene && options.bandeau === false) p.push('bandeau=0');
    if (scene === 'pause' && options.chat === false) p.push('chat=0');
    if (options.cadre) p.push(`cadre=${options.cadre}`);
    return `${siteUrl}/#${p.join('&')}`;
  }

  /** Types de sources « webcam » d'OBS (Windows, Mac, Linux). */
  const WEBCAM_KINDS = new Set(['dshow_input', 'av_capture_input', 'av_capture_input_v2', 'macos_avcapture', 'macos_avcapture_fast', 'v4l2_input']);

  /** Cadre de la webcam dessiné par l'overlay, en pixels d'un écran 1920×1080 (voir .cam dans overlay.css). */
  function camRect(coin) {
    // Le cadre fait 448×252 avec une bordure de 8 px : la webcam se cale 5 px à l'intérieur, sous la bordure.
    const x = coin === 'hd' ? 40 : 1432;
    return { x: x + 5, y: 45, w: 438, h: 242 };
  }

  /** Cadre de la webcam de la scène Pause (470×264 en haut à droite, voir body.pause-cam dans overlay.css).
   *  La page Pause est opaque : la webcam passe au-dessus, et le cadre (source à part) au-dessus d'elle,
   *  pour garder les coins arrondis. Comme en live, la webcam se cale 5 px à l'intérieur, sous la bordure. */
  const PAUSE_CAM = { x: 1395, y: 135, w: 460, h: 254 };

  /**
   * Installe (ou met à jour) les overlays.
   * @param {ObsClient} obs client connecté
   * @param {object} o
   * @param {string} o.siteUrl   site des overlays
   * @param {string} o.key       clé de l'overlay du streamer
   * @param {string[]} o.addTo   scènes existantes où ajouter l'overlay principal (en haut)
   * @param {boolean} o.scenes   créer les 4 scènes plein écran
   * @param {boolean} [o.separate] tout mettre dans une collection de scènes à part (recommandé)
   * @param {object} [o.options] { coin, theme, son }
   * @param {(line: string) => void} [log]
   */
  async function install(obs, { siteUrl, key, addTo = [], scenes = true, separate = false, options = {} }, log = () => {}) {
    let newCollection = false;
    let newProfile = false;
    if (separate) {
      // 1) Profil à part, avec une copie des réglages techniques du profil actuel.
      //    La clé de stream n'est jamais lue ni copiée : le streamer reconnecte son compte Twitch lui-même.
      const video = await obs.request('GetVideoSettings');
      const params = [];
      for (const [parameterCategory, parameterName] of PROFILE_PARAMS) {
        try {
          const r = await obs.request('GetProfileParameter', { parameterCategory, parameterName });
          if (r.parameterValue != null && r.parameterValue !== '') params.push({ parameterCategory, parameterName, parameterValue: String(r.parameterValue) });
        } catch { /* réglage absent : ignoré */ }
      }
      try {
        await obs.request('CreateProfile', { profileName: NAMES.profile });
        newProfile = true;
      } catch (err) {
        if (err.obsCode !== 601) throw err;
        await obs.request('SetCurrentProfile', { profileName: NAMES.profile });
      }
      if (newProfile) {
        const { baseWidth, baseHeight, outputWidth, outputHeight, fpsNumerator, fpsDenominator } = video;
        const wanted = { baseWidth, baseHeight, outputWidth, outputHeight, fpsNumerator, fpsDenominator };
        const fps = fpsNumerator && fpsDenominator ? `${Math.round(fpsNumerator / fpsDenominator)} i/s` : '';
        // OBS peut finir de basculer sur le nouveau profil après sa réponse : on relit, et on réessaie si besoin.
        let videoOk = false;
        let videoErr = '';
        for (let attempt = 0; attempt < 3 && !videoOk; attempt++) {
          if (attempt) await new Promise((r) => setTimeout(r, 1000));
          try {
            await obs.request('SetVideoSettings', wanted);
            const now = await obs.request('GetVideoSettings');
            videoOk = Object.keys(wanted).every((k) => wanted[k] == null || now[k] === wanted[k]);
          } catch (err) { videoErr = err.detail || err.message; }
        }
        let paramsFailed = 0;
        for (const p of params) {
          try {
            await obs.request('SetProfileParameter', p);
            const r = await obs.request('GetProfileParameter', { parameterCategory: p.parameterCategory, parameterName: p.parameterName });
            if (String(r.parameterValue) !== p.parameterValue) paramsFailed++;
          } catch { paramsFailed++; }
        }
        log(`✓ Profil « ${NAMES.profile} » créé`);
        log(videoOk ? `✓ Image recopiée : ${baseWidth}×${baseHeight}${fps ? `, ${fps}` : ''}`
          : `⚠ Image non recopiée${videoErr ? ` (${videoErr})` : ''} : règle-la toi-même dans Paramètres → Vidéo (${baseWidth}×${baseHeight}${fps ? `, ${fps}` : ''})`);
        log(paramsFailed ? `⚠ ${paramsFailed} réglage(s) de sortie non recopié(s) : vérifie ton débit et ton encodeur dans Paramètres → Sortie`
          : '✓ Débit, encodeur et audio recopiés');
      } else log(`✓ Profil « ${NAMES.profile} » ouvert (réglages existants gardés)`);

      // 2) Collection de scènes à part.
      // OBS bascule sur la collection (et attend qu'elle soit chargée) avant de répondre.
      try {
        await obs.request('CreateSceneCollection', { sceneCollectionName: NAMES.collection });
        newCollection = true;
        log(`✓ Collection de scènes « ${NAMES.collection} » créée (ta collection habituelle n'est pas touchée)`);
      } catch (err) {
        if (err.obsCode !== 601) throw err;
        await obs.request('SetCurrentSceneCollection', { sceneCollectionName: NAMES.collection });
        log(`✓ Collection de scènes « ${NAMES.collection} » ouverte`);
      }
      scenes = true;
      addTo = [NAMES.live];
    }

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
      if (options.cam !== false) {
        const what = await upsert(NAMES.scenes.pause[0], NAMES.camFrame, sourceUrl(siteUrl, key, null, { theme: options.theme, cadre: 'pause' }));
        log(`✓ Cadre webcam de la Pause : source ${what}`);
      } else {
        await obs.request('RemoveInput', { inputName: NAMES.camFrame }).catch(() => {}); // cadre décoché : source retirée
      }
    }

    if (separate && !sceneNames.has(NAMES.live)) {
      await obs.request('CreateScene', { sceneName: NAMES.live });
      sceneNames.add(NAMES.live);
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

    // Webcam déjà présente dans la scène de l'overlay : calée dans le cadre, sous l'overlay.
    done.webcams = [];
    done.pauseCam = [];
    if (options.cam !== false && targets.length) {
      const k = W / 1920;
      const fit = (sceneName, sceneItemId, r) => obs.request('SetSceneItemTransform', {
        sceneName, sceneItemId,
        sceneItemTransform: { positionX: r.x * k, positionY: r.y * (H / 1080), alignment: 5, boundsType: 'OBS_BOUNDS_SCALE_OUTER', boundsAlignment: 0,
          boundsWidth: r.w * k, boundsHeight: r.h * (H / 1080), cropToBounds: true, rotation: 0 },
      });
      const r = camRect(options.coin);
      for (const sceneName of targets) {
        const { sceneItems } = await obs.request('GetSceneItemList', { sceneName });
        for (const it of sceneItems.filter((i) => WEBCAM_KINDS.has(i.inputKind))) {
          await fit(sceneName, it.sceneItemId, r);
          log(`✓ Webcam « ${it.sourceName} » calée dans le cadre (${sceneName.replace('📡 ', '')})`);
          if (!done.webcams.includes(it.sourceName)) done.webcams.push(it.sourceName);
        }
      }
      // Scène Pause : la même webcam (pas une copie), ajoutée si besoin, au-dessus de la page.
      const [pauseScene] = NAMES.scenes.pause;
      if (scenes && sceneNames.has(pauseScene)) {
        const { sceneItems } = await obs.request('GetSceneItemList', { sceneName: pauseScene });
        const wanted = done.webcams.length ? done.webcams : sceneItems.filter((i) => WEBCAM_KINDS.has(i.inputKind)).map((i) => i.sourceName);
        for (const sourceName of wanted) {
          const found = sceneItems.find((i) => i.sourceName === sourceName);
          const id = found ? found.sceneItemId : (await obs.request('CreateSceneItem', { sceneName: pauseScene, sourceName, sceneItemEnabled: true })).sceneItemId;
          await fit(pauseScene, id, PAUSE_CAM);
          const { sceneItems: now } = await obs.request('GetSceneItemList', { sceneName: pauseScene });
          await obs.request('SetSceneItemIndex', { sceneName: pauseScene, sceneItemId: id, sceneItemIndex: now.length - 1 });
          log(`✓ Webcam « ${sourceName} » ${found ? 'calée' : 'ajoutée'} dans la scène Pause`);
          done.pauseCam.push(sourceName);
        }
        // Le cadre repasse au-dessus de la webcam.
        const { sceneItems: last } = await obs.request('GetSceneItemList', { sceneName: pauseScene });
        const frame = last.find((i) => i.sourceName === NAMES.camFrame);
        if (frame) await obs.request('SetSceneItemIndex', { sceneName: pauseScene, sceneItemId: frame.sceneItemId, sceneItemIndex: last.length - 1 });
      }
    }

    if (separate) {
      // Nouvelle collection : OBS y met une scène vide par défaut (« Scène »), inutile ici.
      if (newCollection) {
        const ours = new Set([NAMES.live, ...Object.values(NAMES.scenes).map(([s]) => s)]);
        for (const { sceneName } of (await obs.request('GetSceneList')).scenes) {
          if (ours.has(sceneName)) continue;
          const { sceneItems } = await obs.request('GetSceneItemList', { sceneName });
          if (!sceneItems.length) await obs.request('RemoveScene', { sceneName }).catch(() => {});
        }
      }
      await obs.request('SetCurrentProgramScene', { sceneName: NAMES.live }).catch(() => {});
      done.collection = NAMES.collection;
      done.profile = NAMES.profile;
      done.newProfile = newProfile;
    }
    return done;
  }

  root.ObsInstaller = { ObsClient, install, sourceUrl, camRect, authString, NAMES, InstallError };
})(typeof window !== 'undefined' ? window : globalThis);
