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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [mafiaList, setMafiaList] = useState<string[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [allRoles, setAllRoles] = useState<Record<string, string>>({})
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState({
    mafiaCount: 3,
    mafiaKills: 2,
    mafiaSilence: 2,
    mafiaTargetSilence: 1,
    policeQuestions: 2,
    doctorSaves: 2,
    isHostJudge: false
  })

  const [isPreparationPhase, setIsPreparationPhase] = useState(true)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [policeCheckResult, setPoliceCheckResult] = useState<{ name: string, isMafia: boolean } | null>(null)
  const [policeQuestionsUsed, setPoliceQuestionsUsed] = useState(0)
  const [allowedPoliceQuestions, setAllowedPoliceQuestions] = useState(2)
  const [policeFinished, setPoliceFinished] = useState(false)
  const [kickMode, setKickMode] = useState(false)
  const [playerToKick, setPlayerToKick] = useState<string | null>(null)
  const [roundStartTimer, setRoundStartTimer] = useState<number | null>(null)
  const [showRoleCountdown, setShowRoleCountdown] = useState(false)
  const [roleCountdown, setRoleCountdown] = useState(10)
  const [canClickStartRound, setCanClickStartRound] = useState(false)
  const [talkingIndex, setTalkingIndex] = useState<number | null>(null)
  const [talkingTimer, setTalkingTimer] = useState<number>(0)
  const [talkingPhase, setTalkingPhase] = useState(false)
  // const [talkingOrder, setTalkingOrder] = useState<string[]>([])



  const isMafia = role === 'mafia' || role === 'mafia-leader' || role === 'mafia-police'
  const isPolice = role === 'police'
  const isJudge = role === 'judge'

  useEffect(() => {
    const socket = getSocket()
    if (!socket.connected) socket.connect()

    socket.emit('join-room', { roomId, name: playerName })

    socket.on('room-players', (playersList: Player[]) => {
      setPlayers(playersList)
    })

    socket.on('assign-role', ({ name, role, roles, mafiaNames, isJudge, policeQuestionsUsed, allowedPoliceQuestions }) => {
      if (name === playerName) {
        setRole(role)

        if (isJudge && roles) {
          setAllRoles(roles)
        }

        if (mafiaNames && mafiaNames.length > 0) {
          setMafiaList(mafiaNames)
        }

        setRoleCountdown(10)
        setShowRoleCountdown(true)
        setCanClickStartRound(false)


        if (typeof policeQuestionsUsed === 'number') {
          setPoliceQuestionsUsed(policeQuestionsUsed)
        }

        if (typeof allowedPoliceQuestions === 'number') {
          setAllowedPoliceQuestions(allowedPoliceQuestions)
        }
      }
    })



    socket.on('player-kicked', ({ name }) => {
      if (name === playerName) {
        // إعادة توجيه اللاعب المطرود إلى الصفحة الرئيسية
        window.location.href = '/'
      }
    })

    socket.on('round-started', () => {
      setIsPreparationPhase(false)
    })

    socket.on('police-check-result', ({ targetName, isMafia }) => {
      setPoliceCheckResult({ name: targetName, isMafia })
      setPoliceFinished(true)
      setPoliceQuestionsUsed(prev => prev + 1)
    })

    socket.on('error', (msg) => {
      console.warn('🚫', msg)
    })


    return () => {
      socket.disconnect()
    }
  }, [roomId, playerName])


  useEffect(() => {
    if (!showRoleCountdown) return

    const interval = setInterval(() => {
      setRoleCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          setShowRoleCountdown(false)
          setCanClickStartRound(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [showRoleCountdown])


  const handleStartGame = () => {
    const socket = getSocket()
    socket.emit('start-game', roomId, settings)
    setShowSettings(false)
    setIsPreparationPhase(true)
    setPoliceCheckResult(null)
    setSelectedPlayer(null)
    setPoliceFinished(false)

    // إضافة مؤقت لتفعيل زر "ابدأ الجولة" بعد 30 ثانية
    const timer = window.setTimeout(() => {
      setPoliceFinished(true)
    }, 30000)

    setRoundStartTimer(timer)
  }

  useEffect(() => {
    return () => {
      // تنظيف المؤقت عند مغادرة الصفحة
      if (roundStartTimer) {
        clearTimeout(roundStartTimer)
      }
    }
  }, [roundStartTimer])

  useEffect(() => {
    if (!talkingPhase || talkingIndex === null || talkingIndex >= players.length) return

    const timer = setInterval(() => {
      setTalkingTimer(prev => {
        if (prev <= 1) {
          clearInterval(timer)

          // ننتقل للاعب اللي بعده
          if (talkingIndex + 1 < players.length) {
            setTalkingIndex(talkingIndex + 1)
            setTalkingTimer(25) // نرجّع العداد لـ 25 لللاعب الجديد
          } else {
            // خلصوا كل اللاعبين
            setTalkingPhase(false)
            setTalkingIndex(null)
          }

          return 0
        }

        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [talkingPhase, talkingIndex, players.length])


  const handlePlayerCheck = () => {
    if (!selectedPlayer) return

    const socket = getSocket()
    socket.emit('police-question', {
      roomId,
      playerName,
      targetName: selectedPlayer
    })
  }


  const handlePostpone = () => {
    setSelectedPlayer(null)
    setPoliceCheckResult(null)
    setPoliceFinished(true)
  }

  const handleKick = () => {
    const socket = getSocket()
    if (playerToKick) {
      socket.emit('kick-player', { roomId, name: playerToKick })
      setPlayerToKick(null)
      setKickMode(false)
    }
  }

  const handleStartRound = () => {
    if (!canStartRound) return
    const socket = getSocket()
    socket.emit('start-round', { roomId })
    setIsPreparationPhase(false)
    setTalkingPhase(true)
    setTalkingIndex(0)
    setTalkingTimer(25)

  }

  const canStartRound = canClickStartRound

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold mb-6">🎮 غرفة رقم: {roomId}</h1>
      <p className="mb-2">الاسم المستعار: {playerName}</p>
      <p className="mb-4">بانتظار اللاعبين الآخرين...</p>

      <div className="mt-6 w-full max-w-md text-right">
        <h2 className="text-lg font-semibold mb-4">اللاعبين في الغرفة:</h2>

        {showRoleCountdown && (
          <div className="text-center text-yellow-300 font-bold text-lg mt-4">
            جاري تجهيز الجولة... {roleCountdown} ثانية
          </div>
        )}

        <div className="flex flex-col gap-3">
          {players.map((player, i) => {
            const isSelf = player.name === playerName
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const isTalkingNow = talkingPhase && i === talkingIndex
            const isMafiaViewable = isMafia && (player.role === 'mafia' || player.role?.startsWith('mafia'))
            const isChecked = policeCheckResult?.name === player.name
            const isCheckedMafia = policeCheckResult?.isMafia

            const nameColor = isChecked && isPolice
              ? isCheckedMafia ? 'text-red-500 font-bold' : 'text-green-500 font-bold'
              : isMafiaViewable ? 'text-red-500 font-bold'
                : isJudge ? 'text-blue-400 font-bold'
                  : 'text-white'

            const highlight =
              selectedPlayer === player.name && isPolice && isPreparationPhase
                ? 'ring-2 ring-yellow-400'
                : kickMode && isHost ? 'ring-2 ring-red-400 cursor-pointer' : ''

            // const canSeeRole =
            //   player.name === playerName ||
            //   (isMafia && (player.role?.startsWith('mafia') || player.role === 'mafia')) ||
            //   role === 'judge'


            // تحسين عرض الأيقونات
            let icon = ''
            if (player.eliminated) {
              icon = '💀 مطرود'
            } else if (player.role === 'judge') {
              icon = '⚖️ حكم'
            } else if (player.role === 'citizen' && (isSelf || isJudge)) {
              icon = '👤 شعب'
            } else if (player.role === 'mafia' && (isMafia || isJudge)) {
              icon = '🕵️‍♂️ مافيا'
            } else if (player.role === 'mafia-leader' && (isMafia || isJudge)) {
              icon = '👑 زعيم'
            } else if (player.role === 'mafia-police' && (isMafia || isJudge)) {
              icon = '🕶️ شرطي مافيا'
            } else if (player.role === 'police' && (isSelf || isJudge)) {
              icon = '👮‍♂️ شرطي'
            } else if (player.role === 'sniper' && (isSelf || isJudge)) {
              icon = '🎯 قناص'
            } else if (player.role === 'doctor' && (isSelf || isJudge)) {
              icon = '🩺 طبيب'
            }

            return (
              <div
                key={`${player.name}-${i}`}
                onClick={() => {
                  if (kickMode && isHost && player.name !== playerName) {
                    setPlayerToKick(player.name)
                  } else if (isPolice && isPreparationPhase && !policeFinished && player.name !== playerName) {
                    setSelectedPlayer(player.name)
                  }
                }}
                className={`flex items-center justify-between bg-gray-800 border border-white px-4 py-2 rounded-lg ${kickMode && player.name !== playerName ? 'cursor-pointer hover:bg-gray-700' : ''} ${highlight}`}
              >
                <span className={nameColor}>
                  {player.name}
                  {talkingIndex === i && talkingPhase && (
                    <span className="ml-2 text-yellow-400">⏱️ {talkingTimer}s</span>
                  )}
                </span>

                <span className="text-sm text-yellow-400">{icon}</span>
              </div>
            )
          })}
        </div>
      </div>

      {isHost && (
        <div className="flex flex-col items-end gap-4 fixed right-8 top-8">
          <button onClick={() => setShowSettings(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            إعدادات اللعبة
          </button>
          <button
            onClick={handleStartRound}
            disabled={!canStartRound}
            className={`font-bold py-2 px-4 rounded ${!canStartRound ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
          >
            ابدأ الجولة
          </button>
          <button
            onClick={() => {
              setKickMode(!kickMode)
              if (kickMode) setPlayerToKick(null)
            }}
            className={`font-bold py-2 px-4 rounded ${kickMode ? 'bg-gray-600' : 'bg-red-600 hover:bg-red-700'} text-white`}
          >
            {kickMode ? 'إلغاء وضع الطرد' : 'طرد لاعب'}
          </button>
        </div>
      )}

      {kickMode && playerToKick && isHost && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-red-800 p-4 rounded-lg shadow-lg">
          <p className="mb-2 text-white">هل أنت متأكد من طرد {playerToKick}؟</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleKick}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              تأكيد الطرد
            </button>
            <button
              onClick={() => {
                setPlayerToKick(null);
                setKickMode(false);
              }}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
            >
              إلغاء
            </button>
          </div>
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

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.isHostJudge}
                onChange={(e) => setSettings({ ...settings, isHostJudge: e.target.checked })}
              />
              أنا الحكم
            </label>

            <div className="flex justify-between pt-4">
              <button onClick={() => setShowSettings(false)} className="px-4 py-2 bg-gray-700 rounded">إلغاء</button>
              <button
                onClick={handleStartGame}
                disabled={players.length < 5}
                className={`px-4 py-2 rounded font-bold transition ${players.length < 5 ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
              >
                ابدأ اللعبة
              </button>
            </div>
          </div>
        </div>
      )}

      {isPolice && isPreparationPhase && !policeFinished && policeQuestionsUsed < allowedPoliceQuestions && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-lg font-semibold">👮‍♂️ دورك الآن! اختر لاعبًا:</p>
          <p className="text-sm text-yellow-300">
            تبقّى لك {settings.policeQuestions - policeQuestionsUsed} من {settings.policeQuestions} سؤال
          </p>

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
                      : role === 'judge'
                        ? 'حكم'
                        : 'شعب'}
        </div>
      )}
    </main>
  )
} 