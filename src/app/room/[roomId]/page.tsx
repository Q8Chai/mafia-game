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
    isJudge: false,
  })

  const [isPreparationPhase, setIsPreparationPhase] = useState(true)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [policeCheckResult, setPoliceCheckResult] = useState<{ name: string, isMafia: boolean } | null>(null)
  const [policeFinished, setPoliceFinished] = useState(false)
  const [kickMode, setKickMode] = useState(false)

  const isMafia = role === 'mafia' || role === 'mafia-leader' || role === 'mafia-police'
  const isPolice = role === 'police'
  const isJudge = typeof window !== 'undefined' && sessionStorage.getItem('isJudge') === 'true'

  useEffect(() => {
    const socket = getSocket()
    if (!socket.connected) socket.connect()

    socket.emit('join-room', { roomId, name: playerName })

    socket.on('room-players', (playersList: Player[]) => {
      setPlayers(playersList)
    })

    socket.on('assign-role', ({ name, role, isJudge: judgeFlag }) => {
      if (name === playerName) {
        if (judgeFlag) {
          sessionStorage.setItem('isJudge', 'true')
          setRole('')
        } else {
          sessionStorage.setItem('isJudge', 'false')
          setRole(role)
        }
      }
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

  const handleKickConfirm = () => {
    const socket = getSocket()
    if (selectedPlayer) {
      socket.emit('kick-player', { roomId, name: selectedPlayer })
      setSelectedPlayer(null)
      setKickMode(false)
    }
  }

  const canStartRound = !isPreparationPhase || policeFinished

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
            const isChecked = policeCheckResult?.name === player.name
            const isCheckedMafia = policeCheckResult?.isMafia
            const canSeeRole = isSelf || isMafiaViewable || isJudge

            const nameColor = isChecked && isPolice
              ? isCheckedMafia ? 'text-red-500 font-bold' : 'text-green-500 font-bold'
              : isMafiaViewable ? 'text-red-500 font-bold'
              : isJudge ? 'text-yellow-300 font-bold'
              : 'text-white'

            const highlight =
              selectedPlayer === player.name && (isPolice && isPreparationPhase || kickMode)
                ? 'ring-2 ring-yellow-400'
                : ''

            const icon = player.eliminated ? '💀 مطرود' :
              canSeeRole ? (
                player.role === 'citizen' ? '👤 شعب' :
                player.role === 'mafia' ? '🕵️‍♂️ مافيا' :
                player.role === 'mafia-leader' ? '👑 زعيم' :
                player.role === 'mafia-police' ? '🕶️ شرطي مافيا' :
                player.role === 'police' ? '👮‍♂️ شرطي' :
                player.role === 'sniper' ? '🎯 قناص' :
                player.role === 'doctor' ? '🩺 طبيب' : ''
              ) : ''

            return (
              <div
                key={`${player.name}-${i}`}
                onClick={() => {
                  if ((isPolice && isPreparationPhase && !policeCheckResult) || kickMode) {
                    setSelectedPlayer(player.name)
                  }
                }}
                className={`flex items-center justify-between bg-gray-800 border border-white px-4 py-2 rounded-lg cursor-pointer ${highlight}`}
              >
                <span className={nameColor}>{player.name}</span>
                <span className="text-sm text-yellow-400">{icon}</span>
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
            disabled={!canStartRound}
            className={`font-bold py-2 px-4 rounded ${
              !canStartRound ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            ابدأ الجولة
          </button>
          {!kickMode ? (
            <button
              onClick={() => setKickMode(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              طرد لاعب
            </button>
          ) : (
            <button
              onClick={handleKickConfirm}
              className="bg-red-400 hover:bg-red-500 text-white font-bold py-2 px-4 rounded"
            >
              تأكيد طرد: {selectedPlayer || '---'}
            </button>
          )}
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 bg-opacity-80 backdrop-blur-lg p-6 rounded-xl w-full max-w-md text-white space-y-4 shadow-2xl border border-white/20">
            <h2 className="text-xl font-bold mb-4 text-center">إعدادات اللعبة</h2>

            <label>عدد المافيا</label>
            <select className="w-full p-2 rounded bg-gray-800" value={settings.mafiaCount}
              onChange={(e) => setSettings({ ...settings, mafiaCount: parseInt(e.target.value) })}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            <label>عدد الاغتيالات</label>
            <select className="w-full p-2 rounded bg-gray-800" value={settings.mafiaKills}
              onChange={(e) => setSettings({ ...settings, mafiaKills: parseInt(e.target.value) })}>
              {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            <label>عدد مرات الاسكات الجماعي</label>
            <select className="w-full p-2 rounded bg-gray-800" value={settings.mafiaSilence}
              onChange={(e) => setSettings({ ...settings, mafiaSilence: parseInt(e.target.value) })}>
              {[1, 2].map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            <label>اسكات لاعب معين</label>
            <select className="w-full p-2 rounded bg-gray-800" value={settings.mafiaTargetSilence}
              onChange={(e) => setSettings({ ...settings, mafiaTargetSilence: parseInt(e.target.value) })}>
              {[0, 1].map(n => <option key={n} value={n}>{n === 1 ? 'مسموح' : 'غير مسموح'}</option>)}
            </select>

            <label>عدد أسئلة الشرطي</label>
            <select className="w-full p-2 rounded bg-gray-800" value={settings.policeQuestions}
              onChange={(e) => setSettings({ ...settings, policeQuestions: parseInt(e.target.value) })}>
              {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            <label>عدد مرات الحماية للطبيب</label>
            <select className="w-full p-2 rounded bg-gray-800" value={settings.doctorSaves}
              onChange={(e) => setSettings({ ...settings, doctorSaves: parseInt(e.target.value) })}>
              {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            <label className="flex items-center gap-2 pt-4">
              <input
                type="checkbox"
                checked={settings.isJudge}
                onChange={(e) => setSettings({ ...settings, isJudge: e.target.checked })}
              />
              أنا حكم (أشاهد فقط)
            </label>

            <div className="flex justify-between pt-4">
              <button onClick={() => setShowSettings(false)} className="px-4 py-2 bg-gray-700 rounded">
                إلغاء
              </button>
              <button
                onClick={handleStartGame}
                disabled={players.length < 5}
                className={`px-4 py-2 rounded font-bold transition ${
                  players.length < 5
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                ابدأ اللعبة
              </button>
            </div>
          </div>
        </div>
      )}

      {isPolice && isPreparationPhase && !policeFinished && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-lg font-semibold">👮‍♂️ دورك الآن! اختر لاعبًا:</p>
          <div className="flex gap-4">
            <button
              onClick={handlePostpone}
              className="bg-gray-700 hover:bg-gray-800 text-white py-2 px-4 rounded"
            >
              تأجيل السؤال
            </button>
            {selectedPlayer && (
              <button
                onClick={handlePlayerCheck}
                className="bg-yellow-500 hover:bg-yellow-600 text-black py-2 px-4 rounded"
              >
                تأكيد السؤال عن: {selectedPlayer}
              </button>
            )}
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
