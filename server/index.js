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
      const isJudge = rooms[roomId].judgeName === name
      const allRoles = rooms[roomId].roles
      const mafiaNames = getMafiaNames(roomId, name)

      // أرسل الدور لهذا اللاعب فقط
      socket.emit('assign-role', {
        name,
        role,
        roles: isJudge ? allRoles : {}, // الحكم يشوف الكل
        mafiaNames,                     // المافيا يشوفون زملاءهم
        isJudge,
        policeQuestionsUsed: rooms[roomId].policeQuestionsUsed?.[name] || 0,
        allowedPoliceQuestions: rooms[roomId].settings?.policeQuestions || 2,

      })

      io.to(roomId).emit('roles-assigned', rooms[roomId].roles)


      // أرسل معلومات اللاعبين مع أدوارهم
      io.to(roomId).emit('room-players', rooms[roomId].players.map(p => ({
        ...p,
        role: rooms[roomId].roles[p.name] || '',
      })))
    } else {
      io.to(roomId).emit('room-players', rooms[roomId].players)
    }
  })

  function getMafiaNames(roomId, playerName) {
    const roles = rooms[roomId]?.roles || {}
    const mafiaNames = []

    for (const [name, role] of Object.entries(roles)) {
      if (role.includes('مافيا')) {
        mafiaNames.push(name)
      }
    }

    if (!roles[playerName]?.includes('مافيا')) return []
    return mafiaNames.filter((n) => n !== playerName)
  }


  socket.on('check-room', (roomId, callback) => {
    const exists = !!rooms[roomId]
    callback(exists)
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
    const mafiaCount = settings.mafiaCount || 3

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

    rooms[roomId].policeQuestionsUsed = {}
    rooms[roomId].lastPoliceQuestionRound = {}
    rooms[roomId].currentRound = 0


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

  socket.on('police-question', ({ roomId, playerName, targetName }) => {
    const room = rooms[roomId]
    if (!room) return

    const allowedQuestions = room.settings.policeQuestions || 2

    // تأكد من وجود العدادات
    if (!room.policeQuestionsUsed) room.policeQuestionsUsed = {}
    if (!room.lastPoliceQuestionRound) room.lastPoliceQuestionRound = {}
    if (room.currentRound === undefined) room.currentRound = 0

    const used = room.policeQuestionsUsed[playerName] || 0
    const lastAskedRound = room.lastPoliceQuestionRound[playerName]
    const currentRound = room.currentRound

    // ❌ إذا تجاوز عدد الأسئلة
    if (used >= allowedQuestions) {
      socket.emit('error', '❌ انتهت عدد مرات السؤال المسموحة.')
      return
    }

    // ❌ إذا سأل بنفس الجولة
    if (lastAskedRound === currentRound) {
      socket.emit('error', '❌ لا يمكنك السؤال مرتين في نفس الجولة.')
      return
    }

    // ✅ نسجل السؤال
    room.policeQuestionsUsed[playerName] = used + 1
    room.lastPoliceQuestionRound[playerName] = currentRound

    const isMafia = room.roles[targetName]?.includes('مافيا')
    socket.emit('police-check-result', { targetName, isMafia })
  })



  socket.on('disconnect', () => {
    //  هذا الي حدثته ... يمكن إضافة منطق لإزالة اللاعب عند قطع الاتصال هنا
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
