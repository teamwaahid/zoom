const videoGrid = document.getElementById('video-grid');
const muteBtn = document.getElementById('muteBtn');
const cameraoff = document.getElementById('cameraoff');
const selectCam = document.getElementById('selectCam');
const selectMic = document.getElementById('selectMic');
const screenShare = document.getElementById('screenShare');
const chatbox = document.getElementById('chat_box');
const chatButton = document.getElementById('chat_button');
const participantbox = document.getElementById('participant_box');
const participantButton = document.getElementById('participant_button');
const expandButton = document.querySelector('#expand');

chatButton.addEventListener('click', function (e) {
  const display = chatbox.style.display === 'none' ? 'block' : 'none';
  chatbox.style.display = display;
  participantbox.style.display = 'none';
});

participantButton.addEventListener('click', function (e) {
  const display = participantbox.style.display === 'block' ? 'none' : 'block';
  participantbox.style.display = display;
  chatbox.style.display = 'none';
  console.log(display);
});

[...videoGrid.children].forEach(el => {
  el.addEventListener('click', function (e) {
    // console.log(e.target);

    if (el.id === e.target.id) {
      console.log(el.id);
      const name = el.id;

      if (el.id) {
      }
    }
  });
});

// socket init
const socket = io();

let mediaStream;
let mute = false;
let camera = true;
let currentCam;
let RTC;
let myVideoId;

// sound mute or unmute handler
muteBtn.addEventListener('click', e => {
  const muteTxt = document.getElementById('muteTxt');
  if (mute) {
    mute = false;
    muteTxt.textContent = 'Mute';
    mediaStream.getAudioTracks().forEach(track => {
      track.enabled = true;
    });
  } else {
    mute = true;
    muteTxt.textContent = 'Unmute';
    mediaStream.getAudioTracks().forEach(track => {
      track.enabled = false;
    });
  }
});

// camera on or of handler
cameraoff.addEventListener('click', () => {
  const cameraTxt = document.getElementById('cameraTxt');
  if (camera) {
    cameraTxt.textContent = 'Start Video';
    camera = false;
    mediaStream.getVideoTracks().forEach(track => {
      track.enabled = false;
    });
  } else {
    cameraTxt.textContent = 'Stop Video';
    camera = true;
    mediaStream.getVideoTracks().forEach(track => {
      track.enabled = true;
    });
  }
});

// getting the medias
async function getMedia(cameraId, micId) {
  currentCam = cameraId === null ? currentCam : cameraId;

  const initialConstraits = {
    video: true,
    audio: true,
  };

  const preferredCameraConstraints = {
    video: { deviceId: cameraId },
    audio: true,
  };

  const videoOption = currentCam ? { deviceId: currentCam } : true;

  const preferredMicConstraints = {
    video: videoOption,
    audio: { deviceId: micId },
  };

  try {
    mediaStream = await window.navigator.mediaDevices.getUserMedia(
      cameraId || micId
        ? cameraId
          ? preferredCameraConstraints
          : preferredMicConstraints
        : initialConstraits
    );

    // send joining notification

    if (!(cameraId || micId)) {
      displayMedia(mediaStream, true);
      getAllCameras();
      getAllMics();
      makeWebRTCConnection();

      // room joining event
      socket.emit('joinRoom', roomId);
    } else {
      const myVideoEl = document.getElementById('myVideoId');
      console.log(myVideoEl);
      myVideoEl.srcObject = mediaStream;

      // add media tracks to RTC
      const videoTrack = mediaStream.getVideoTracks()[0];
      const audioTrack = mediaStream.getAudioTracks()[0];

      if (RTC) {
        const senders = RTC.getSenders();
        console.log(senders);
        if (cameraId) {
          const videoSender = senders.find(
            sender => sender.track.kind === 'video'
          );
          videoSender.replaceTrack(videoTrack);
        }
        if (micId) {
          const audioSender = senders.find(
            sender => sender.track.kind === 'audio'
          );
          audioSender.replaceTrack(audioTrack);
        }
      }
    }
  } catch (error) {
    console.log(error);
  }
}

getMedia();

async function getScreenMedia() {
  try {
    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: true,
    });

    const micTrack = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    mediaStream.addTrack(micTrack.getAudioTracks()[0], micTrack);
    RTC.addTrack(mediaStream.getAudioTracks()[0], mediaStream);

    const myVideoEl = document.getElementById(myVideoId);
    myVideoEl.srcObject = mediaStream;

    // todo

    const senders = RTC.getSenders();

    const videoTrack = mediaStream.getVideoTracks()[0];
    const systemAudioTrack = mediaStream.getAudioTracks().find(track => {
      return track.label === 'System Audio';
    });
    const micAudioTrack = mediaStream.getAudioTracks().find(track => {
      return track.label !== 'System Audio';
    });

    if (systemAudioTrack) {
      RTC.addTrack(systemAudioTrack, mediaStream);
    }

    const videoSender = senders.find(sender => sender.track.kind === 'video');

    const audioSenders = senders.filter(
      sender => sender.track.kind === 'audio'
    );

    videoSender.replaceTrack(videoTrack);

    if (systemAudioTrack) {
      audioSenders[0].replaceTrack(systemAudioTrack);
      audioSenders[1].replaceTrack(micAudioTrack);
    } else {
      audioSenders[0].replaceTrack(micAudioTrack);
    }

    displayMedia(mediaStream);
  } catch (error) {
    console.log(error);
  }
}

screenShare.addEventListener('click', getScreenMedia);

// display media
function displayMedia(stream, media) {
  const video = document.createElement('video');
  if (media) {
    myVideoId = stream.id;
    video.muted = true;
  }
  video.id = stream.id;
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
  });
  videoGrid.appendChild(video);
}

// get all cameras
async function getAllCameras() {
  const currentCamera = mediaStream.getVideoTracks()[0];
  const allDevices = await window.navigator.mediaDevices.enumerateDevices();
  selectCam.innerHTML = '';

  allDevices.forEach(device => {
    if (device.kind === 'videoinput') {
      const option = document.createElement('li');
      option.value = device.deviceId;
      option.textContent = device.label;
      option.selected = device.label === currentCamera.label ? true : false;
      selectCam.appendChild(option);
    }
  });
}

// get all mics
async function getAllMics() {
  const currentMic = mediaStream.getAudioTracks()[0];
  const allDevices = await window.navigator.mediaDevices.enumerateDevices();
  selectMic.innerHTML = '';
  allDevices.forEach(device => {
    if (device.kind === 'audioinput') {
      const option = document.createElement('li');
      option.value = device.deviceId;
      option.textContent = device.label;
      option.selected = device.label === currentMic.label ? true : false;
      selectMic.appendChild(option);
    }
  });
}

// select a specific camera
selectCam.addEventListener('input', e => {
  const cameraId = e.target.value;
  getMedia(cameraId);
});

// select a specific mic
selectMic.addEventListener('input', e => {
  const micId = e.target.value;
  getMedia(null, micId);
});

/// socket

socket.on('newJoining', () => {
  makeAOffer();
});

/* var configuration = {
  RTC = new RTCPeerConnection({
    iceServers: [{
      urls: "stun:stun.l.google.com:19302"
    }, {
      urls: ["turn:eu-0.turn.peerjs.com:3478", "turn:eu-1.turn.peerjs.com:3478"],
      username: "peerjs",
      credential: "peerjsp"
    }, {
      urls: ["turn:us-0.turn.peerjs.com:3478", "turn:us-1.turn.peerjs.com:3478"],
      username: "peerjs",
      credential: "peerjsp"
    }],
    sdpSemantics: "unified-plan"
  })
} */

// make WebRTC connection
function makeWebRTCConnection() {
  // rtc init
  RTC = new RTCPeerConnection({
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302',
      },
      {
        urls: [
          'turn:eu-0.turn.peerjs.com:3478',
          'turn:eu-1.turn.peerjs.com:3478',
        ],
        username: 'peerjs',
        credential: 'peerjsp',
      },
      {
        urls: [
          'turn:us-0.turn.peerjs.com:3478',
          'turn:us-1.turn.peerjs.com:3478',
        ],
        username: 'peerjs',
        credential: 'peerjsp',
      },
    ],
    sdpSemantics: 'unified-plan',
  });

  // add media tracks to RTC
  mediaStream.getTracks().forEach(track => {
    RTC.addTrack(track, mediaStream);
  });

  // send ICE candidate
  RTC.addEventListener('icecandidate', data => {
    socket.emit('sendIceCandidate', data.candidate, roomId);
  });

  // add ICE candidate
  RTC.addEventListener('addstream', data => {
    displayMedia(data.stream);
    /* const videoTag = document.createElement('video');
    videoTag.srcObject = data.stream;
    videoTag.addEventListener('loadedmetadata', () => {
      videoTag.play();
    });
    videoGrid.appendChild(videoTag); */
  });
}

// make a offer
async function makeAOffer() {
  dataChannel = RTC.createDataChannel('zoom');
  dataChannel.addEventListener('open', () => {
    dataChannel.addEventListener('message', e => {
      const msgUl = document.querySelector('.msgDisplay');
      const li = document.createElement('li');
      li.textContent = 'Someone: ' + e.data;
      msgUl.appendChild(li);
    });
  });

  const offer = await RTC.createOffer();
  RTC.setLocalDescription(offer);
  // send the offer
  socket.emit('sendTheOffer', offer, roomId);
}

// receive offer
socket.on('receiveOffer', async offer => {
  RTC.addEventListener('datachannel', () => {
    dataChannel = e.channel;
    dataChannel.addEventListener('message', e => {
      const msgUl = document.querySelector('.msgDisplay');
      const li = document.createElement('li');
      li.textContent = 'Someone: ' + e.data;
      msgUl.appendChild(li);
    });
  });

  RTC.setRemoteDescription(offer);
  const answer = await RTC.createAnswer();
  RTC.setLocalDescription(answer);

  // send the answer
  socket.emit('sendTheAnswer', answer, roomId);
});

// message form handler
document.getElementById('msgForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const msg = document.getElementById('msgForm')[0].value;
  const msgUl = document.querySelector('.msgDisplay');
  const li = document.createElement('li');
  li.textContent = 'You: ' + msg;
  msgUl.appendChild(li);
  dataChannel.send(msg);
  document.getElementById('msgForm')[0].value = '';
});

// receive answer
socket.on('receiveAnswer', answer => {
  RTC.setRemoteDescription(answer);
});

// receive answer
socket.on('receiveCandidate', candidate => {
  RTC.addIceCandidate(candidate);
});

socket.on('Someone_left', socketId => {
  console.log(socketId);
});
