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
  })

  const [isPreparationPhase, setIsPreparationPhase] = useState(true)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [policeCheckResult, setPoliceCheckResult] = useState<{ name: string, isMafia: boolean } | null>(null)
  const [policeFinished, setPoliceFinished] = useState(false)

  const isMafia = role === 'mafia' || role === 'mafia-leader' || role === 'mafia-police'
  const isPolice = role === 'police'

  const [canStartRound, setCanStartRound] = useState(false)

  useEffect(() => {
    if (isPreparationPhase) {
      setCanStartRound(false)
      const timer = setTimeout(() => {
        setCanStartRound(true)
      }, 30000) // 30 seconds

      return () => clearTimeout(timer)
    }
  }, [isPreparationPhase])

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
    setIsPreparationPhase(true)
    setPoliceCheckResult(null)
    setSelectedPlayer(null)
    setPoliceFinished(false)
  }

  const handlePlayerCheck = () => {
    const target = players.find(p => p.name === selectedPlayer)
    if (!target) return
    const isTargetMafia = ['mafia', 'mafia-leader', 'mafia-police'].includes(target.role || '')
    setPoliceCheckResult({ name: target.name, isMafia: isTargetMafia })
    setPoliceFinished(true)
  }

  const handlePostpone = () => {
    setSelectedPlayer(null)
    setPoliceCheckResult(null)
    setPoliceFinished(true)
  }

  const startRound = () => {
    const socket = getSocket()
    socket.emit('start-round', roomId)
    setIsPreparationPhase(false)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold mb-6">🎮 غرفة رقم: {roomId}</h1>
      <p className="mb-2">الاسم المستعار: {playerName}</p>
      <p className="mb-4">بانتظار اللاعبين الآخرين...</p>

      <div className="mt-6 w-full max-w-md text-right">
        <h2 className="text-lg font-semibold mb-4">اللاعبين في الغرفة:</h2>
        <div className="flex flex-col gap-3">
          {players.map((player, index) => (
            <div
              key={index}
              className={`p-2 rounded ${
                player.eliminated ? 'bg-gray-700 line-through' : 'bg-gray-800'
              }`}
            >
              {player.name} {player.name === playerName && `(${role})`}
            </div>
          ))}
        </div>
      </div>

      {isHost && (
        <button
          disabled={!canStartRound}
          onClick={startRound}
          className={`mt-4 px-4 py-2 rounded ${
            canStartRound ? 'bg-green-600' : 'bg-gray-500'
          }`}
        >
          ابدأ الجولة
        </button>
      )}

      {isHost && !showSettings && (
        <button
          onClick={() => setShowSettings(true)}
          className="mt-6 bg-blue-600 px-4 py-2 rounded"
        >
          إعدادات اللعبة
        </button>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
          <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">إعدادات اللعبة</h2>
            {/* إعدادات الأدوار */}
            <div className="space-y-4">
              {/* يمكن إضافة مدخلات لتعديل الإعدادات هنا */}
            </div>
            <button
              onClick={handleStartGame}
              className="mt-6 bg-green-600 px-4 py-2 rounded"
            >
              ابدأ اللعبة
            </button>
          </div>
        </div>
      )}

      {isPolice && isPreparationPhase && !policeFinished && (
        <div className="mt-6 text-center">
          <h3 className="mb-2">دور الشرطي: اختر لاعبًا للتحقق منه</h3>
          <div className="flex flex-wrap justify-center gap-2">
            {players.map((player) => (
              <button
                key={player.name}
                onClick={() => setSelectedPlayer(player.name)}
                className={`px-3 py-1 rounded ${
                  selectedPlayer === player.name ? 'bg-yellow-500' : 'bg-gray-700'
                }`}
              >
                {player.name}
              </button>
            ))}
          </div>
          <div className="mt-4 space-x-2">
            <button
              onClick={handlePlayerCheck}
              className="bg-green-600 px-3 py-1 rounded"
            >
              سؤال الآن
            </button>
            <button
              onClick={handlePostpone}
              className="bg-red-600 px-3 py-1 rounded"
            >
              تأجيل السؤال
            </button>
          </div>
        </div>
      )}

      {policeCheckResult && isPolice && (
        <div className="mt-4 text-center">
          <p>
            اللاعب {policeCheckResult.name}{' '}
            {policeCheckResult.isMafia ? (
              <span className="text-red-500">مافيا</span>
            ) : (
              <span className="text-green-400">ليس مافيا</span>
            )}
          </p>
        </div>
      )}
    </main>
  )
}
