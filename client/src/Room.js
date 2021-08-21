import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Peer from 'simple-peer';

const Video = ({ peer }) => {
  const videoRef = useRef();
  useEffect(() => {
    peer.on('stream', (stream) => {
      videoRef.current.srcObject = stream;
    });
  }, [peer]);
  return <video ref={videoRef} autoPlay></video>;
};

export const Room = () => {
  const socket = io('http://localhost:5000');
  const ROOM_ID = 50;
  const [peers, setPeers] = useState([]);

  const userVideoRef = useRef();
  const peerRefs = useRef([]);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true,
      })
      .then((stream) => {
        userVideoRef.current.srcObject = stream;
        socket.emit('joined-room', 'Room 1');

        socket.on(
          'users-in-room',
          ({ usersInRoom, socketId: userSocketId }) => {
            usersInRoom.forEach((socketId) => {
              const peer = new Peer({
                initiator: true,
                trickle: false,
                stream,
              });
              const peerObj = {
                peerSocketId: socketId,
                peer,
              };
              peerRefs.current.push(peerObj);
              setPeers((users) => [...users, peerObj]);

              peer.on('signal', (signal) => {
                socket.emit('requesting-to-connect-stream', {
                  newPeerSignal: signal,
                  userToConnectTo: socketId,
                  newPeerSocketId: userSocketId,
                });
              });
              peer.on('close', () => {
                const list = peerRefs.current.filter(
                  ({ peerSocketId }) => peerSocketId !== socketId
                );
                peerRefs.current = list;
              });
            });
          }
        );

        socket.on(
          'new-stream-incoming',
          ({ newPeerSignal, newPeerSocketId }) => {
            const peer = new Peer({
              initiator: false,
              trickle: false,
              stream,
            });
            peer.on('signal', (signal) => {
              socket.emit('added-new-stream', {
                otherUserSignal: signal,
                newPeerSocketId,
              });
            });
            peer.on('close', () => {
              const list = peerRefs.current.filter(
                ({ peerSocketId }) => peerSocketId !== newPeerSocketId
              );
              peerRefs.current = list;
            });

            peer.signal(newPeerSignal);

            const peerObj = {
              peerSocketId: newPeerSocketId,
              peer,
            };
            peerRefs.current.push(peerObj);
            setPeers((users) => [...users, peerObj]);
          }
        );

        socket.on(
          'new-peer-stream-added',
          ({ otherUserSignal, otherUserSocketId }) => {
            const item = peerRefs.current.find(
              (p) => p.peerSocketId === otherUserSocketId
            );

            item.peer.signal(otherUserSignal);
          }
        );
      })
      .catch((error) => {
        console.error('Error accessing media devices.', error);
      });
    socket.on('user-disconnected', (socketId) => {
      console.log(`user ${socketId} left the room`);
      const peerObjsLeft = peerRefs.current.filter(
        (peerObj) => peerObj.peerSocketId !== socketId
      );
      const disconnectedPeer = peerRefs.current.find(
        (peerObj) => peerObj.peerSocketId === socketId
      );
      if (disconnectedPeer) disconnectedPeer.peer.destroy();
      peerRefs.current = peerObjsLeft;
      setPeers(peerObjsLeft);
    });
  }, []);

  return (
    <div>
      <video ref={userVideoRef} autoPlay muted></video>
      {peers.map((peerObj, index) => (
        <Video key={peerObj.peerSocketId} peer={peerObj.peer} />
      ))}
    </div>
  );
};
