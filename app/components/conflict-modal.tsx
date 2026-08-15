'use client'

import { useState } from 'react'
import { resolveConflict, clearStoredConflicts, type SyncConflict } from '@/lib/supabase/sync'
import { AlertTriangle, X } from 'lucide-react'

export default function ConflictModal({
  conflicts,
  userId,
  onResolved,
  onClose,
}: {
  conflicts: SyncConflict[]
  userId: string
  onResolved: () => void
  onClose: () => void
}) {
  const [resolving, setResolving] = useState<Record<string, 'local' | 'remote' | null>>({})
  const [done, setDone] = useState(false)

  async function handleResolveAll(choice: 'local' | 'remote') {
    setDone(true)
    for (const c of conflicts) {
      await resolveConflict(c.ficheId, choice, userId)
    }
    clearStoredConflicts()
    onResolved()
  }

  async function handleResolveOne(sessionId: string, choice: 'local' | 'remote') {
    setResolving((prev) => ({ ...prev, [sessionId]: choice }))
    await resolveConflict(sessionId, choice, userId)
    setResolving((prev) => ({ ...prev, [sessionId]: null }))
    const remaining = conflicts.filter((c) => c.ficheId !== sessionId)
    if (remaining.length === 0) {
      clearStoredConflicts()
      setDone(true)
      onResolved()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 bg-black/50">
      <div className="w-full max-w-lg mx-4 rounded-xl border border-foreground/10 bg-background shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/8">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-[#b87840]" />
            <span className="text-sm font-semibold">
              Conflit{conflicts.length > 1 ? 's' : ''} de synchronisation
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {!done && (
          <div className="px-5 py-3 border-b border-foreground/6 bg-foreground/[0.02] flex gap-2">
            <button
              type="button"
              onClick={() => handleResolveAll('local')}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors cursor-pointer"
            >
              Tout garder local
            </button>
            <button
              type="button"
              onClick={() => handleResolveAll('remote')}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-foreground/10 text-foreground/70 hover:bg-foreground/5 transition-colors cursor-pointer"
            >
              Tout garder distant
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {conflicts.map((c) => (
            <div key={c.ficheId}>
              <p className="text-sm font-semibold mb-2">{c.ficheLabel}</p>

              {c.fields.length > 0 ? (
                <div className="rounded-lg border border-foreground/8 overflow-hidden text-xs mb-3">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-foreground/[0.03] text-foreground/40 text-[10px] uppercase tracking-wider">
                        <th className="text-left px-3 py-1.5 font-medium">Champ</th>
                        <th className="text-left px-3 py-1.5 font-medium">Local</th>
                        <th className="text-left px-3 py-1.5 font-medium">Distant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-foreground/6">
                      {c.fields.map((f) => (
                        <tr key={f.field}>
                          <td className="px-3 py-1.5 text-foreground/60 whitespace-nowrap">{f.field}</td>
                          <td className="px-3 py-1.5 text-foreground/85 max-w-[120px] truncate">{f.local}</td>
                          <td className="px-3 py-1.5 text-foreground/85 max-w-[120px] truncate">{f.remote}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-foreground/40 mb-3">Seuls les timestamps diffèrent.</p>
              )}

              {!done && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleResolveOne(c.ficheId, 'local')}
                    disabled={resolving[c.ficheId] != null}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    {resolving[c.ficheId] === 'local' ? '…' : 'Garder local'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolveOne(c.ficheId, 'remote')}
                    disabled={resolving[c.ficheId] != null}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-foreground/10 text-foreground/70 hover:bg-foreground/5 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    {resolving[c.ficheId] === 'remote' ? '…' : 'Garder distant'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {done && (
          <div className="px-5 py-3 border-t border-foreground/8">
            <button
              type="button"
              onClick={onClose}
              className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors cursor-pointer"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
