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

  const [isPreparationPhase, setIsPreparationPhase] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [policeCheckResult, setPoliceCheckResult] = useState<{ name: string, isMafia: boolean } | null>(null)
  const [canCheckNow, setCanCheckNow] = useState(false)

  const isMafia = role === 'mafia' || role === 'mafia-leader' || role === 'mafia-police'
  const isPolice = role === 'police'

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
    setCanCheckNow(false)
  }

  const handlePlayerCheck = () => {
    const target = players.find(p => p.name === selectedPlayer)
    if (!target) return
    const isTargetMafia = ['mafia', 'mafia-leader', 'mafia-police'].includes(target.role || '')
    setPoliceCheckResult({ name: target.name, isMafia: isTargetMafia })
    setIsPreparationPhase(false)
  }

  const roleIcon = (player: Player) => {
    if (player.eliminated) return '💀 مطرود'
    if (player.name !== playerName && !isMafia) return ''
    switch (player.role) {
      case 'citizen': return '👤 شعب'
      case 'mafia': return '🕵️‍♂️ مافيا'
      case 'mafia-leader': return '👑 زعيم'
      case 'mafia-police': return '🕶️ شرطي مافيا'
      case 'police': return '👮‍♂️ شرطي'
      case 'sniper': return '🎯 قناص'
      case 'doctor': return '🩺 طبيب'
      default: return ''
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold mb-6">🎮 غرفة رقم: {roomId}</h1>
      <p className="mb-2">الاسم المستعار: {playerName}</p>
      <p className="mb-4">بانتظار اللاعبين الآخرين...</p>

      <div className="mt-6 w-full max-w-md text-right">
        <h2 className="text-lg font-semibold mb-4">اللاعبين في الغرفة:</h2>
        <div className="flex flex-col gap-3">
          {players.map((player, i) => {
            const isSelf = player.name === playerName
            const isMafiaViewable = isMafia && (player.role === 'mafia' || player.role?.startsWith('mafia'))

            const highlight =
              policeCheckResult?.name === player.name
                ? policeCheckResult.isMafia
                  ? 'text-red-500'
                  : 'text-green-500'
                : selectedPlayer === player.name
                ? 'ring-2 ring-yellow-400'
                : ''

            return (
              <div
                key={`${player.name}-${i}`}
                onClick={() => {
                  if (isPolice && isPreparationPhase && canCheckNow) {
                    setSelectedPlayer(player.name)
                  }
                }}
                className={`flex items-center justify-between bg-gray-800 border border-white px-4 py-2 rounded-lg cursor-pointer ${highlight}`}
              >
                <span className={isMafiaViewable ? 'text-red-500 font-bold' : 'text-white'}>
                  {player.name}
                </span>
                <span className="text-sm text-yellow-400">{roleIcon(player)}</span>
              </div>
            )
          })}
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
            disabled={isPreparationPhase}
            className={`font-bold py-2 px-4 rounded ${
              isPreparationPhase ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            ابدأ الجولة
          </button>
        </div>
      )}

      {isPolice && isPreparationPhase && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-lg font-semibold">👮‍♂️ دورك الآن! اختر لاعبًا:</p>
          <div className="flex gap-4">
            {!canCheckNow ? (
              <button
                onClick={() => setCanCheckNow(true)}
                className="bg-yellow-500 hover:bg-yellow-600 text-black py-2 px-4 rounded"
              >
                سؤال الآن
              </button>
            ) : (
              selectedPlayer && (
                <button
                  onClick={handlePlayerCheck}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black py-2 px-4 rounded"
                >
                  تأكيد السؤال عن: {selectedPlayer}
                </button>
              )
            )}
            <button
              onClick={() => {
                setSelectedPlayer(null)
                setCanCheckNow(false)
                setIsPreparationPhase(false)
              }}
              className="bg-gray-700 hover:bg-gray-800 text-white py-2 px-4 rounded"
            >
              تأجيل السؤال
            </button>
          </div>
        </div>
      )}

      {role && (
        <div className="mt-8 text-xl font-bold text-yellow-400 flex items-center gap-2">
          🎭 دورك هو:{' '}
          {role === 'doctor'
            ? 'طبيب'
            : role === 'mafia'
            ? 'مافيا'
            : role === 'mafia-leader'
            ? 'زعيم المافيا'
            : role === 'mafia-police'
            ? 'شرطي مافيا'
            : role === 'police'
            ? 'شرطي'
            : role === 'sniper'
            ? 'قناص'
            : 'شعب'}
        </div>
      )}
    </main>
  )
}
