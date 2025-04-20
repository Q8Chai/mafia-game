const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: '*',
  },
})

let rooms = {}

io.on('connection', (socket) => {
  socket.on('join-room', ({ roomId, name }) => {
    socket.join(roomId)
    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        settings: {},
        roles: {},
        judgeName: null,
      }
    }

    const playerExists = rooms[roomId].players.find((p) => p.name === name)
    if (!playerExists) {
      rooms[roomId].players.push({ name })
    }

    // أرسل معلومات الأدوار إذا كانت اللعبة قد بدأت
    if (Object.keys(rooms[roomId].roles).length > 0) {
      const role = rooms[roomId].roles[name] || ''
      socket.emit('assign-role', { name, role })
      
      // أرسل معلومات اللاعبين مع أدوارهم
      io.to(roomId).emit('room-players', rooms[roomId].players.map(p => ({
        ...p,
        role: rooms[roomId].roles[p.name] || '',
      })))
    } else {
      io.to(roomId).emit('room-players', rooms[roomId].players)
    }
  })

  socket.on('start-game', (roomId, settings) => {
    if (!rooms[roomId]) return

    const players = [...rooms[roomId].players]
    const isJudge = settings.isHostJudge
    const judgeName = isJudge ? players[0].name : null
    rooms[roomId].judgeName = judgeName
    rooms[roomId].settings = settings

    // استبعاد الحكم من توزيع الأدوار
    const playersToAssignRoles = isJudge 
      ? players.filter(p => p.name !== judgeName) 
      : players

    const totalPlayersInGame = playersToAssignRoles.length
    const mafiaCount = Math.min(settings.mafiaCount || 3, Math.floor(totalPlayersInGame / 3))
    const roles = ['doctor', 'sniper', 'police']

    const mafiaRoles = ['mafia-leader', 'mafia-police']
    for (let i = 2; i < mafiaCount; i++) mafiaRoles.push('mafia')

    const remainingRoles = [...mafiaRoles, ...roles]
    const shuffledPlayers = playersToAssignRoles.sort(() => 0.5 - Math.random())

    const assignedRoles = {}
    
    // تعيين الأدوار للاعبين (ما عدا الحكم)
    for (const player of shuffledPlayers) {
      const role = remainingRoles.length > 0 ? remainingRoles.shift() : 'citizen'
      assignedRoles[player.name] = role
    }

    // تعيين دور الحكم إذا كان الهوست حكمًا
    if (isJudge && judgeName) {
      assignedRoles[judgeName] = 'judge'
    }

    rooms[roomId].roles = assignedRoles

    // إرسال الأدوار إلى اللاعبين
    for (const player of players) {
      const role = assignedRoles[player.name] || ''
      io.to(roomId).emit('assign-role', { name: player.name, role })
    }

    // تحديث حالة اللاعبين في الغرفة
    io.to(roomId).emit('room-players', players.map(p => ({
      ...p,
      role: assignedRoles[p.name] || ''
    })))
  })

  socket.on('kick-player', ({ roomId, name }) => {
    if (!rooms[roomId]) return
    
    // تحديث قائمة اللاعبين بعد الطرد
    rooms[roomId].players = rooms[roomId].players.filter(p => p.name !== name)
    
    // حذف الدور من قائمة الأدوار
    if (rooms[roomId].roles[name]) {
      delete rooms[roomId].roles[name]
    }
    
    // إعلام جميع اللاعبين بالتغيير
    io.to(roomId).emit('player-kicked', { name })
    io.to(roomId).emit('room-players', rooms[roomId].players.map(p => ({
      ...p,
      role: rooms[roomId].roles[p.name] || ''
    })))
  })

  socket.on('start-round', ({ roomId }) => {
    if (!rooms[roomId]) return
    io.to(roomId).emit('round-started')
  })

  socket.on('disconnect', () => {
    // يمكن إضافة منطق لإزالة اللاعب عند قطع الاتصال هنا
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
