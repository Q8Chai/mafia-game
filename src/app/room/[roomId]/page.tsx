'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useParams } from 'next/navigation'
import { getSocket } from '@/lib/socket'

type Player = {
  name: string
  role?: string
  eliminated?: boolean
}

export default function RoomPage() {
  const searchParams = useSearchParams()
  const params = useParams()
  const roomId = params.roomId as string
  const playerName = searchParams.get('name') || ''
  const isHost = searchParams.get('host') === 'true'

  const [players, setPlayers] = useState<Player[]>([])
  const [role, setRole] = useState<string>('')
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState({
    mafiaCount: 3,
    mafiaKills: 2,
    mafiaSilence: 2,
    mafiaTargetSilence: 1,
    policeQuestions: 2,
    doctorSaves: 2,
    isReferee: false,
  })

  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [showKickMode, setShowKickMode] = useState(false)

  const isMafia = ['mafia', 'mafia-leader', 'mafia-police'].includes(role)
  const isReferee = isHost && settings.isReferee && role === ''

  useEffect(() => {
    const socket = getSocket()
    if (!socket.connected) socket.connect()

    socket.emit('join-room', { roomId, name: playerName })

    socket.on('room-players', (playersList: Player[]) => {
      setPlayers(playersList)
    })

    socket.on('assign-role', ({ name, role }) => {
      if (name === playerName) setRole(role)
    })

    return () => {
      socket.disconnect()
    }
  }, [roomId, playerName])

  const handleStartGame = () => {
    const socket = getSocket()
    socket.emit('start-game', roomId, settings)
    setShowSettings(false)
  }

  const handleKick = () => {
    if (selectedPlayer) {
      const socket = getSocket()
      socket.emit('kick-player', { roomId, name: selectedPlayer })
      setSelectedPlayer(null)
      setShowKickMode(false)
    }
  }

  const roleIcon = (player: Player) => {
    if (player.eliminated) return '💀 مطرود'
    if (isReferee || player.name === playerName || (isMafia && ['mafia', 'mafia-leader', 'mafia-police'].includes(player.role || ''))) {
      switch (player.role) {
        case 'citizen': return '👤 شعب'
        case 'mafia': return '🕵️‍♂️ مافيا'
        case 'mafia-leader': return '👑 زعيم'
        case 'mafia-police': return '🕶️ شرطي مافيا'
        case 'police': return '👮‍♂️ شرطي'
        case 'sniper': return '🎯 قناص'
        case 'doctor': return '🩺 طبيب'
      }
    }
    return ''
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold mb-6">🎮 غرفة رقم: {roomId}</h1>
      <p className="mb-2">الاسم المستعار: {playerName}</p>
      <p className="mb-4">بانتظار اللاعبين الآخرين...</p>

      <div className="mt-6 w-full max-w-md text-right">
        <h2 className="text-lg font-semibold mb-4">اللاعبين في الغرفة:</h2>
        <div className="flex flex-col gap-3">
          {players.map((player, i) => (
            <div
              key={`${player.name}-${i}`}
              onClick={() => showKickMode && setSelectedPlayer(player.name)}
              className={`flex items-center justify-between bg-gray-800 border border-white px-4 py-2 rounded-lg cursor-pointer ${selectedPlayer === player.name ? 'ring-2 ring-red-400' : ''}`}
            >
              <span className="text-white">{player.name}</span>
              <span className="text-sm text-yellow-400">{roleIcon(player)}</span>
            </div>
          ))}
        </div>
      </div>

      {isHost && (
        <div className="flex flex-col items-end gap-4 fixed right-8 top-8">
          <button
            onClick={() => setShowSettings(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            إعدادات اللعبة
          </button>
          <button
            onClick={() => setShowKickMode(!showKickMode)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          >
            طرد لاعب
          </button>
          {showKickMode && selectedPlayer && (
            <button
              onClick={handleKick}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded"
            >
              تأكيد طرد: {selectedPlayer}
            </button>
          )}
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 bg-opacity-90 backdrop-blur p-6 rounded-xl w-full max-w-md text-white space-y-4 shadow-2xl border border-white/20">
            <h2 className="text-xl font-bold mb-4 text-center">إعدادات اللعبة</h2>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.isReferee}
                onChange={(e) => setSettings({ ...settings, isReferee: e.target.checked })}
              />
              أنا الحكم
            </label>

            {/* بقية الإعدادات مثل عدد المافيا وغيرها */}
            <label>عدد المافيا</label>
            <select className="w-full p-2 rounded bg-gray-800" value={settings.mafiaCount}
              onChange={(e) => setSettings({ ...settings, mafiaCount: parseInt(e.target.value) })}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            <div className="flex justify-between pt-4">
              <button onClick={() => setShowSettings(false)} className="px-4 py-2 bg-gray-700 rounded">إلغاء</button>
              <button onClick={handleStartGame} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded">ابدأ اللعبة</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
