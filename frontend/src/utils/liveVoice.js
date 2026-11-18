// Live (hands-free) interview mode: streams the microphone to the server over
// WebRTC (Pipecat SmallWebRTC). The server detects when an answer is finished,
// transcribes it, checks the voice, and sends the result back on the data channel.
//
// Server messages: {type:'ready'} {type:'speaking'} {type:'processing'}
//                  {type:'answer', text, original, language, voice} {type:'no_speech'} {type:'error', message}
// Client messages: {type:'listen', on:boolean} {type:'language', value:'en'|'ta-en'}

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function waitForIceGathering(pc, timeoutMs = 3000) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', check);
      clearTimeout(timer);
      resolve();
    };
    const check = () => { if (pc.iceGatheringState === 'complete') done(); };
    const timer = setTimeout(done, timeoutMs); // send what we have; host candidates suffice on a LAN
    pc.addEventListener('icegatheringstatechange', check);
  });
}

export async function isLiveModeAvailable(client) {
  try {
    const res = await client.get('/live/status');
    return !!res.data?.available;
  } catch {
    return false;
  }
}

/**
 * Start live mode. Returns a controller: { setListening(on), setLanguage(lang), stop() }.
 * onMessage(msg) gets every server message; onStateChange(state) gets
 * 'connecting' | 'connected' | 'failed' | 'closed'.
 */
export async function startLiveVoice({ client, sessionId, language = 'en', onMessage, onStateChange }) {
  onStateChange?.('connecting');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  const track = stream.getAudioTracks()[0];
  track.enabled = false; // only open while the interview is waiting for an answer

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, bundlePolicy: 'max-bundle' });
  // Pipecat expects the microphone on the first transceiver
  pc.addTransceiver(track, { direction: 'sendrecv', streams: [stream] });
  const dc = pc.createDataChannel('chat', { ordered: true });

  let listening = false;
  const send = (msg) => {
    if (dc.readyState === 'open') dc.send(JSON.stringify(msg));
  };

  dc.onopen = () => send({ type: 'listen', on: listening });
  dc.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg && msg.type === 'signalling') return; // Pipecat's own renegotiation messages
    onMessage?.(msg);
  };
  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    if (s === 'connected') onStateChange?.('connected');
    else if (s === 'failed') onStateChange?.('failed');
    else if (s === 'closed' || s === 'disconnected') onStateChange?.('closed');
  };

  await pc.setLocalDescription(await pc.createOffer());
  await waitForIceGathering(pc);

  let answer;
  try {
    const res = await client.post(`/live/${sessionId}/offer`, {
      sdp: pc.localDescription.sdp,
      type: pc.localDescription.type,
      language,
    }, { timeout: 30000 });
    answer = res.data;
  } catch (err) {
    pc.close();
    stream.getTracks().forEach((t) => t.stop());
    onStateChange?.('failed');
    throw err;
  }
  await pc.setRemoteDescription({ sdp: answer.sdp, type: answer.type });

  return {
    setListening(on) {
      listening = !!on;
      track.enabled = listening; // muted mic sends silence, so the question being read out is never captured
      send({ type: 'listen', on: listening });
    },
    setLanguage(lang) {
      send({ type: 'language', value: lang });
    },
    stop() {
      try { dc.close(); } catch { /* already closed */ }
      try { pc.close(); } catch { /* already closed */ }
      stream.getTracks().forEach((t) => t.stop());
      onStateChange?.('closed');
    },
  };
}
