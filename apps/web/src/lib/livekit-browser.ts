"use client";

import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
} from "livekit-client";

export async function connectInterviewLiveKit(input: {
  url: string;
  token: string;
  localStream?: MediaStream | null;
}): Promise<Room> {
  const room = new Room();
  await room.connect(input.url, input.token);
  if (input.localStream) {
    for (const track of input.localStream.getTracks()) {
      await room.localParticipant.publishTrack(track);
    }
  }
  return room;
}

export async function connectFaceToFaceLiveKit(input: {
  url: string;
  token: string;
  localStream?: MediaStream | null;
}): Promise<Room> {
  const room = new Room();
  await room.connect(input.url, input.token);
  if (input.localStream) {
    for (const track of input.localStream.getTracks()) {
      await room.localParticipant.publishTrack(track);
    }
    return room;
  }
  await room.localParticipant.setMicrophoneEnabled(true);
  try {
    await room.localParticipant.setCameraEnabled(true);
  } catch {
    /* Camera optional nếu trình duyệt từ chối; micro vẫn publish. */
  }
  return room;
}

function participantLabel(participant: { name?: string; identity: string }) {
  return participant.name || participant.identity;
}

function ensureAudioRoot(container: HTMLElement) {
  let audioRoot = container.querySelector<HTMLElement>("[data-remote-audio]");
  if (!audioRoot) {
    audioRoot = document.createElement("div");
    audioRoot.dataset.remoteAudio = "true";
    audioRoot.className = "sr-only";
    container.appendChild(audioRoot);
  }
  return audioRoot;
}

function tileId(identity: string, source: Track.Source) {
  return `${identity}:${source}`;
}

export function attachRemoteMedia(
  room: Room,
  container: HTMLElement,
  onParticipantsChange?: (count: number, names: string[]) => void,
) {
  const audioRoot = ensureAudioRoot(container);

  const report = () => {
    const names = [...room.remoteParticipants.values()].map((item) => participantLabel(item));
    onParticipantsChange?.(names.length, names);
  };

  const attach = (
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) => {
    const identity = participantLabel(participant);
    const key = tileId(identity, publication.source);
    if (track.kind === Track.Kind.Audio) {
      container.querySelector(`audio[data-tile="${CSS.escape(key)}"]`)?.remove();
      const el = track.attach();
      el.autoplay = true;
      el.dataset.tile = key;
      audioRoot.appendChild(el);
      return;
    }
    if (track.kind !== Track.Kind.Video) return;
    container.querySelector(`[data-tile="${CSS.escape(key)}"]`)?.remove();
    const wrap = document.createElement("div");
    wrap.dataset.tile = key;
    wrap.className = "relative overflow-hidden rounded-2xl bg-[#1f1f1f] min-h-[180px]";
    const el = track.attach();
    el.className =
      publication.source === Track.Source.ScreenShare
        ? "h-full w-full object-contain bg-black"
        : "h-full w-full object-cover";
    wrap.appendChild(el);
    const label = document.createElement("div");
    label.className =
      "absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white";
    label.textContent =
      publication.source === Track.Source.ScreenShare ? `${identity} · màn hình` : identity;
    wrap.appendChild(label);
    container.appendChild(wrap);
  };

  const detach = (identity: string, source?: Track.Source) => {
    if (source) {
      const key = tileId(identity, source);
      container.querySelector(`[data-tile="${CSS.escape(key)}"]`)?.remove();
      container.querySelector(`audio[data-tile="${CSS.escape(key)}"]`)?.remove();
      return;
    }
    container
      .querySelectorAll(`[data-tile^="${CSS.escape(identity)}:"]`)
      .forEach((node) => node.remove());
    container
      .querySelectorAll(`audio[data-tile^="${CSS.escape(identity)}:"]`)
      .forEach((node) => node.remove());
  };

  for (const participant of room.remoteParticipants.values()) {
    for (const publication of participant.trackPublications.values()) {
      if (publication.track) attach(publication.track, publication, participant);
    }
  }
  report();

  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    attach(track, publication, participant);
    report();
  });
  room.on(RoomEvent.TrackUnsubscribed, (_track, publication, participant) => {
    detach(participantLabel(participant), publication.source);
    report();
  });
  room.on(RoomEvent.ParticipantConnected, report);
  room.on(RoomEvent.ParticipantDisconnected, (participant) => {
    detach(participantLabel(participant));
    report();
  });
}

export async function sendRoomChat(room: Room, text: string) {
  const payload = new TextEncoder().encode(JSON.stringify({ type: "chat", text, at: Date.now() }));
  await room.localParticipant.publishData(payload, { reliable: true });
}

export function listenRoomChat(
  room: Room,
  onMessage: (input: { from: string; text: string; at: number }) => void,
) {
  room.on(RoomEvent.DataReceived, (payload, participant) => {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(payload)) as {
        type?: string;
        text?: string;
        at?: number;
      };
      if (parsed?.type !== "chat" || !parsed.text) return;
      onMessage({
        from: participant ? participantLabel(participant) : "Người kia",
        text: parsed.text,
        at: typeof parsed.at === "number" ? parsed.at : Date.now(),
      });
    } catch {
      /* ignore non-chat payloads */
    }
  });
}
