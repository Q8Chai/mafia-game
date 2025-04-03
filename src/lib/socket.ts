import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export const getSocket = () => {
  if (!socket) {
    socket = io('https://mafia-game-1.onrender.com') // رابط السيرفر المستضاف على Render
  }
  return socket
}
