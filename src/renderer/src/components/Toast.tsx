export interface AppNotice { id: string; type: 'info' | 'success' | 'error'; message: string; action?: { label: string; onClick: () => void } }
interface Props { notices: AppNotice[]; onClose: (id: string) => void }

export function Toast({ notices, onClose }: Props): React.JSX.Element | null {
  if (!notices.length) return null
  return <div className="app-toast-stack">{notices.map((notice) => (
    <div key={notice.id} className={`app-toast app-toast-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
      <span>{notice.message}</span>{notice.action ? <button type="button" onClick={() => { notice.action?.onClick(); onClose(notice.id) }}>{notice.action.label}</button> : null}<button type="button" aria-label="Close notification" onClick={() => onClose(notice.id)}>×</button>
    </div>
  ))}</div>
}
