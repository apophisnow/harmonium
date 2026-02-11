import { useCallback, useEffect, useRef } from 'react';
import * as mediasoupClient from 'mediasoup-client';
import type { types as mediasoupTypes } from 'mediasoup-client';
import { useVoiceStore } from '../stores/voice.store.js';
import { useToastStore } from '../stores/toast.store.js';
import { useAuthStore } from '../stores/auth.store.js';
import * as voiceApi from '../api/voice.js';
import type { VoiceState } from '@harmonium/shared';

const SPEAKING_THRESHOLD = -50; // dB
const SPEAKING_CHECK_INTERVAL = 100; // ms

export function useVoice() {
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const sendTransportRef = useRef<mediasoupTypes.Transport | null>(null);
  const recvTransportRef = useRef<mediasoupTypes.Transport | null>(null);
  const producerRef = useRef<mediasoupTypes.Producer | null>(null);
  const consumersRef = useRef<Map<string, mediasoupTypes.Consumer>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelIdRef = useRef<string | null>(null);
  const screenProducerRef = useRef<mediasoupTypes.Producer | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isDeafened = useVoiceStore((s) => s.isDeafened);

  const addToast = useToastStore((s) => s.addToast);
  const currentUser = useAuthStore((s) => s.user);

  const storeActions = useRef({
    joinChannel: useVoiceStore.getState().joinChannel,
    leaveChannel: useVoiceStore.getState().leaveChannel,
    setConnecting: useVoiceStore.getState().setConnecting,
    setConnected: useVoiceStore.getState().setConnected,
    addParticipant: useVoiceStore.getState().addParticipant,
    removeParticipant: useVoiceStore.getState().removeParticipant,
    updateParticipant: useVoiceStore.getState().updateParticipant,
    setParticipants: useVoiceStore.getState().setParticipants,
    toggleMute: useVoiceStore.getState().toggleMute,
    toggleDeafen: useVoiceStore.getState().toggleDeafen,
    setScreenSharing: useVoiceStore.getState().setScreenSharing,
    setScreenShareUser: useVoiceStore.getState().setScreenShareUser,
  });

  // Keep refs in sync
  useEffect(() => {
    storeActions.current = {
      joinChannel: useVoiceStore.getState().joinChannel,
      leaveChannel: useVoiceStore.getState().leaveChannel,
      setConnecting: useVoiceStore.getState().setConnecting,
      setConnected: useVoiceStore.getState().setConnected,
      addParticipant: useVoiceStore.getState().addParticipant,
      removeParticipant: useVoiceStore.getState().removeParticipant,
      updateParticipant: useVoiceStore.getState().updateParticipant,
      setParticipants: useVoiceStore.getState().setParticipants,
      toggleMute: useVoiceStore.getState().toggleMute,
      toggleDeafen: useVoiceStore.getState().toggleDeafen,
      setScreenSharing: useVoiceStore.getState().setScreenSharing,
      setScreenShareUser: useVoiceStore.getState().setScreenShareUser,
    };
  });

  const stopSpeakingDetection = useCallback(() => {
    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }
  }, []);

  const startSpeakingDetection = useCallback(() => {
    stopSpeakingDetection();

    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    speakingIntervalRef.current = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;

      // Convert to dB-like scale (0-255 -> roughly -100 to 0)
      const db = average > 0 ? 20 * Math.log10(average / 255) : -100;

      const isSpeaking = db > SPEAKING_THRESHOLD;

      if (currentUser) {
        storeActions.current.updateParticipant(currentUser.id, { isSpeaking });
      }
    }, SPEAKING_CHECK_INTERVAL);
  }, [currentUser, stopSpeakingDetection]);

  const cleanupMedia = useCallback(() => {
    stopSpeakingDetection();

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    // Stop local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close producer
    if (producerRef.current) {
      producerRef.current.close();
      producerRef.current = null;
    }

    // Close screen share producer and stream
    if (screenProducerRef.current) {
      screenProducerRef.current.close();
      screenProducerRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    for (const video of videoElementsRef.current.values()) {
      video.pause();
      video.srcObject = null;
    }
    videoElementsRef.current.clear();

    // Close consumers and audio elements
    for (const consumer of consumersRef.current.values()) {
      consumer.close();
    }
    consumersRef.current.clear();

    for (const audio of audioElementsRef.current.values()) {
      audio.pause();
      audio.srcObject = null;
    }
    audioElementsRef.current.clear();

    // Close transports
    if (sendTransportRef.current) {
      sendTransportRef.current.close();
      sendTransportRef.current = null;
    }
    if (recvTransportRef.current) {
      recvTransportRef.current.close();
      recvTransportRef.current = null;
    }

    deviceRef.current = null;
  }, [stopSpeakingDetection]);

  const consumeProducer = useCallback(
    async (producerId: string, userId: string) => {
      const channelId = channelIdRef.current;
      if (!channelId || !deviceRef.current || !recvTransportRef.current) return;

      try {
        const consumerInfo = await voiceApi.consume({
          channelId,
          producerId,
          rtpCapabilities: deviceRef.current.rtpCapabilities,
        });

        const consumer = await recvTransportRef.current.consume({
          id: consumerInfo.id,
          producerId: consumerInfo.producerId,
          kind: consumerInfo.kind,
          rtpParameters: consumerInfo.rtpParameters as mediasoupClient.types.RtpParameters,
        });

        consumersRef.current.set(consumer.id, consumer);

        if (consumer.kind === 'audio') {
          // Play audio through HTMLAudioElement
          const stream = new MediaStream([consumer.track]);
          const audio = new Audio();
          audio.srcObject = stream;
          audio.autoplay = true;

          // If deafened, mute audio
          audio.muted = useVoiceStore.getState().isDeafened;

          audioElementsRef.current.set(userId, audio);
          await audio.play().catch(() => {
            // Autoplay may be blocked
          });
        } else if (consumer.kind === 'video') {
          const stream = new MediaStream([consumer.track]);
          storeActions.current.setScreenShareUser(userId);
          storeActions.current.updateParticipant(userId, { isScreenSharing: true });
          window.dispatchEvent(
            new CustomEvent('voice:screen_share_stream', {
              detail: { userId, stream },
            }),
          );
        }
      } catch (error) {
        console.error(`Failed to consume producer ${producerId}:`, error);
      }
    },
    [],
  );

  const join = useCallback(
    async (channelId: string, serverId: string) => {
      // Don't rejoin the same channel
      if (channelIdRef.current === channelId) return;

      // If already in a channel, leave first
      if (channelIdRef.current) {
        await leave();
      }

      channelIdRef.current = channelId;
      storeActions.current.joinChannel(channelId, serverId);

      try {
        // 1. Call server to join voice channel
        const joinResult = await voiceApi.joinVoice(channelId);

        // 2. Create mediasoup Device
        const device = new mediasoupClient.Device();
        await device.load({
          routerRtpCapabilities: joinResult.rtpCapabilities as mediasoupClient.types.RtpCapabilities,
        });
        deviceRef.current = device;

        // 3. Create send transport
        const sendTransport = device.createSendTransport(
          joinResult.sendTransport as mediasoupClient.types.TransportOptions,
        );

        sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            await voiceApi.connectTransport({
              channelId,
              transportId: sendTransport.id,
              dtlsParameters,
            });
            callback();
          } catch (e) {
            errback(e as Error);
          }
        });

        sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
          try {
            const { producerId } = await voiceApi.produce({
              channelId,
              transportId: sendTransport.id,
              kind,
              rtpParameters,
            });
            callback({ id: producerId });
          } catch (e) {
            errback(e as Error);
          }
        });

        sendTransportRef.current = sendTransport;

        // 4. Create recv transport
        const recvTransport = device.createRecvTransport(
          joinResult.recvTransport as mediasoupClient.types.TransportOptions,
        );

        recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            await voiceApi.connectTransport({
              channelId,
              transportId: recvTransport.id,
              dtlsParameters,
            });
            callback();
          } catch (e) {
            errback(e as Error);
          }
        });

        recvTransportRef.current = recvTransport;

        // 5. Get microphone audio
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        localStreamRef.current = stream;

        // 6. Set up speaking detection
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        // 7. Produce audio
        const audioTrack = stream.getAudioTracks()[0];
        const producer = await sendTransport.produce({
          track: audioTrack,
          codecOptions: {
            opusStereo: true,
            opusDtx: true,
          },
        });
        producerRef.current = producer;

        // 8. Mark connected
        storeActions.current.setConnected(true);

        // 9. Add self as participant
        if (currentUser) {
          storeActions.current.addParticipant({
            userId: currentUser.id,
            username: currentUser.username,
            avatarUrl: currentUser.avatarUrl ?? null,
            isMuted: false,
            isDeafened: false,
            isSpeaking: false,
            isScreenSharing: false,
          });
        }

        // 10. Fetch existing voice states for the server
        try {
          const voiceStates = await voiceApi.getVoiceStates(serverId);
          for (const state of voiceStates) {
            if (state.userId !== currentUser?.id && state.channelId === channelId) {
              storeActions.current.addParticipant({
                userId: state.userId,
                username: state.username,
                avatarUrl: null,
                isMuted: state.selfMute,
                isDeafened: state.selfDeaf,
                isSpeaking: false,
                isScreenSharing: false,
              });
            }
          }
        } catch {
          // Non-critical, participants will appear via WS events
        }

        // 11. Consume existing producers
        for (const existing of joinResult.existingProducers) {
          await consumeProducer(existing.producerId, existing.userId);
          if (existing.kind === 'video') {
            storeActions.current.setScreenShareUser(existing.userId);
            storeActions.current.updateParticipant(existing.userId, { isScreenSharing: true });
          }
        }

        // 12. Start speaking detection
        startSpeakingDetection();
      } catch (error) {
        console.error('Failed to join voice channel:', error);
        cleanupMedia();
        storeActions.current.leaveChannel();
        channelIdRef.current = null;
        addToast('error', 'Failed to join voice channel. Check your microphone permissions.');
      }
    },
    [currentUser, consumeProducer, startSpeakingDetection, cleanupMedia, addToast],
  );

  const leave = useCallback(async () => {
    const channelId = channelIdRef.current;
    channelIdRef.current = null;

    cleanupMedia();

    if (channelId) {
      try {
        await voiceApi.leaveVoice(channelId);
      } catch {
        // Ignore leave errors
      }
    }

    storeActions.current.leaveChannel();
  }, [cleanupMedia]);

  const toggleMute = useCallback(() => {
    storeActions.current.toggleMute();
    const newMuted = useVoiceStore.getState().isMuted;

    // Pause/resume producer
    if (producerRef.current) {
      if (newMuted) {
        producerRef.current.pause();
      } else {
        producerRef.current.resume();
      }
    }
  }, []);

  const toggleDeafen = useCallback(() => {
    storeActions.current.toggleDeafen();
    const newDeafened = useVoiceStore.getState().isDeafened;

    // Mute/unmute all audio elements
    for (const audio of audioElementsRef.current.values()) {
      audio.muted = newDeafened;
    }

    // Also pause/resume producer when deafened (mutes mic too)
    if (producerRef.current) {
      if (newDeafened) {
        producerRef.current.pause();
      } else if (!useVoiceStore.getState().isMuted) {
        producerRef.current.resume();
      }
    }
  }, []);

  const stopScreenShare = useCallback(async () => {
    if (screenProducerRef.current) {
      screenProducerRef.current.close();
      screenProducerRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    storeActions.current.setScreenSharing(false);

    const currentState = useVoiceStore.getState();
    if (currentState.screenShareUserId === currentUser?.id) {
      storeActions.current.setScreenShareUser(null);
    }
    if (currentUser) {
      storeActions.current.updateParticipant(currentUser.id, { isScreenSharing: false });
    }

    try {
      await voiceApi.stopScreenShare();
    } catch {
      // Ignore errors
    }
  }, [currentUser]);

  const startScreenShare = useCallback(async () => {
    if (!channelIdRef.current || !sendTransportRef.current || !deviceRef.current) return;
    if (screenProducerRef.current) return; // Already sharing

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as MediaTrackConstraints,
        audio: false,
      });

      screenStreamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0];

      videoTrack.onended = () => {
        stopScreenShare();
      };

      const producer = await sendTransportRef.current.produce({
        track: videoTrack,
      });

      screenProducerRef.current = producer;
      storeActions.current.setScreenSharing(true);
      storeActions.current.setScreenShareUser(currentUser?.id ?? null);
      if (currentUser) {
        storeActions.current.updateParticipant(currentUser.id, { isScreenSharing: true });
      }
    } catch (error) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      console.error('Failed to start screen share:', error);
    }
  }, [currentUser, stopScreenShare]);

  // Handle VOICE_STATE_UPDATE events from WebSocket
  useEffect(() => {
    const handleVoiceStateUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail as VoiceState & {
        username: string;
      };

      const storeState = useVoiceStore.getState();
      if (!storeState.currentChannelId) return;
      if (detail.userId === currentUser?.id) return;

      // User left voice (empty channelId means left)
      if (!detail.channelId || detail.channelId === '') {
        storeActions.current.removeParticipant(detail.userId);

        // Clean up consumer audio elements for this user
        const audio = audioElementsRef.current.get(detail.userId);
        if (audio) {
          audio.pause();
          audio.srcObject = null;
          audioElementsRef.current.delete(detail.userId);
        }
        return;
      }

      // User joined or updated in our channel
      if (detail.channelId === storeState.currentChannelId) {
        const existing = storeState.participants.get(detail.userId);
        if (existing) {
          storeActions.current.updateParticipant(detail.userId, {
            isMuted: detail.selfMute,
            isDeafened: detail.selfDeaf,
          });
        } else {
          storeActions.current.addParticipant({
            userId: detail.userId,
            username: detail.username,
            avatarUrl: null,
            isMuted: detail.selfMute,
            isDeafened: detail.selfDeaf,
            isSpeaking: false,
            isScreenSharing: false,
          });
        }
      }
    };

    window.addEventListener('ws:voice_state_update', handleVoiceStateUpdate);
    return () => {
      window.removeEventListener('ws:voice_state_update', handleVoiceStateUpdate);
    };
  }, [currentUser]);

  // Handle NEW_PRODUCER and PRODUCER_CLOSED events from WebSocket
  useEffect(() => {
    const handleNewProducer = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        producerId: string;
        userId: string;
        kind: 'audio' | 'video';
        channelId: string;
      };

      const storeState = useVoiceStore.getState();
      if (!storeState.currentChannelId) return;
      if (detail.channelId !== storeState.currentChannelId) return;
      if (detail.userId === currentUser?.id) return;

      consumeProducer(detail.producerId, detail.userId);
    };

    const handleProducerClosed = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        producerId: string;
        userId: string;
        kind: 'audio' | 'video';
        channelId: string;
      };

      if (detail.userId === currentUser?.id) return;

      if (detail.kind === 'video') {
        storeActions.current.setScreenShareUser(null);
        storeActions.current.updateParticipant(detail.userId, { isScreenSharing: false });
        window.dispatchEvent(
          new CustomEvent('voice:screen_share_ended', { detail: { userId: detail.userId } }),
        );
      }

      for (const [consumerId, consumer] of consumersRef.current) {
        if (consumer.producerId === detail.producerId) {
          consumer.close();
          consumersRef.current.delete(consumerId);
          break;
        }
      }
    };

    window.addEventListener('ws:new_producer', handleNewProducer);
    window.addEventListener('ws:producer_closed', handleProducerClosed);
    return () => {
      window.removeEventListener('ws:new_producer', handleNewProducer);
      window.removeEventListener('ws:producer_closed', handleProducerClosed);
    };
  }, [currentUser, consumeProducer]);

  // Sync muted state with producer when isMuted changes externally
  useEffect(() => {
    if (producerRef.current && currentChannelId) {
      if (isMuted || isDeafened) {
        producerRef.current.pause();
      } else {
        producerRef.current.resume();
      }
    }
  }, [isMuted, isDeafened, currentChannelId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, [cleanupMedia]);

  return { join, leave, toggleMute, toggleDeafen, startScreenShare, stopScreenShare };
}
