import { useEffect, useRef, useState } from 'react'
import { AppError } from '../core/errors'
import type { City } from '../core/cities'
import { isDuplicateCoordinate, type Point } from '../core/points'
import { loadAmap } from '../amap/load'
import { loadSuggestions, searchPlaces, type PlaceResult, type Suggestion } from '../amap/search'

interface SearchOverlayProps {
  open: boolean
  city: City
  points: Point[]
  history: string[]
  onClose: () => void
  onAdd: (place: PlaceResult) => void
  onHistoryChange: (history: string[]) => void
}

export default function SearchOverlay({
  open,
  city,
  points,
  history,
  onClose,
  onAdd,
  onHistoryChange
}: SearchOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionId = useRef(0)
  const searchId = useRef(0)
  const [keyword, setKeyword] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [results, setResults] = useState<PlaceResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) {
      suggestionId.current += 1
      searchId.current += 1
      return
    }
    setKeyword('')
    setSuggestions([])
    setResults([])
    setLoading(false)
    setSearched(false)
    setError('')
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    const value = keyword.trim()
    if (!value) {
      setSuggestions([])
      return
    }
    const timer = window.setTimeout(() => {
      const requestId = ++suggestionId.current
      loadAmap()
        .then((amap) => loadSuggestions(amap, value, city.name))
        .then((list) => {
          if (suggestionId.current === requestId) setSuggestions(list)
        })
        .catch(() => {
          if (suggestionId.current === requestId) setSuggestions([])
        })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [keyword, city.name, open])

  async function runSearch(raw?: string): Promise<void> {
    const value = (raw ?? keyword).trim()
    if (!value) return
    const requestId = ++searchId.current
    suggestionId.current += 1
    setSuggestions([])
    setResults([])
    setError('')
    setLoading(true)
    setSearched(true)
    onHistoryChange([value, ...history.filter((item) => item !== value)].slice(0, 10))
    try {
      const amap = await loadAmap()
      const list = await searchPlaces(amap, value, city.name)
      if (searchId.current === requestId) setResults(list)
    } catch (cause) {
      if (searchId.current === requestId) {
        setError(cause instanceof AppError ? cause.message : '搜索失败，请重试')
      }
    } finally {
      if (searchId.current === requestId) setLoading(false)
    }
  }

  function chooseSuggestion(name: string): void {
    setKeyword(name)
    setSuggestions([])
    void runSearch(name)
  }

  function isAdded(place: PlaceResult): boolean {
    return isDuplicateCoordinate(points, place.lat, place.lng)
  }

  return (
    <dialog
      ref={dialogRef}
      className="search-dialog"
      aria-labelledby="search-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="search-panel">
        <header className="search-header">
          <h2 id="search-dialog-title" className="sr-only">
            搜索地点
          </h2>
          <div className="search-input-row">
            <input
              ref={inputRef}
              value={keyword}
              placeholder={`在${city.name}搜索地点`}
              aria-label="搜索地点"
              onChange={(event) => {
                setKeyword(event.target.value)
                setSearched(false)
                setResults([])
                setError('')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void runSearch()
                }
              }}
            />
            <button type="button" className="btn primary" onClick={() => void runSearch()} disabled={loading}>
              搜索
            </button>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭搜索">
              ✕
            </button>
          </div>
          <p className="search-city-hint">当前城市：{city.name}</p>
        </header>

        <div className="search-body" aria-live="polite">
          {loading && <p className="status-text">搜索中…</p>}

          {!loading && error && (
            <div className="status-card">
              <p>{error}</p>
              <button type="button" className="btn ghost" onClick={() => void runSearch()}>
                重试
              </button>
            </div>
          )}

          {!loading && !error && suggestions.length > 0 && (
            <ul className="suggestion-list" aria-label="搜索建议">
              {suggestions.map((suggestion) => (
                <li key={`${suggestion.id}-${suggestion.name}`}>
                  <button type="button" onClick={() => chooseSuggestion(suggestion.name)}>
                    <span>{suggestion.name}</span>
                    <span className="muted">{suggestion.district}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!loading && !error && results.length > 0 && (
            <ul className="result-list" aria-label="搜索结果">
              {results.map((place) => {
                const added = isAdded(place)
                return (
                  <li key={place.id}>
                    <button
                      type="button"
                      disabled={added}
                      onClick={() => onAdd(place)}
                      aria-label={`${place.title}${added ? '（已添加）' : '，添加到路线'}`}
                    >
                      <span className="result-main">
                        <span className="result-title">{place.title}</span>
                        <span className="result-address muted">{place.address || ' '}</span>
                      </span>
                      <span className={added ? 'result-state added' : 'result-state'}>
                        {added ? '已添加' : '添加'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {!loading && !error && searched && results.length === 0 && suggestions.length === 0 && (
            <p className="status-text">未找到相关地点</p>
          )}

          {!loading && !error && !searched && !keyword.trim() && history.length > 0 && (
            <section className="history" aria-label="搜索记录">
              <div className="history-head">
                <h3>搜索记录</h3>
                <button type="button" className="btn ghost" onClick={() => onHistoryChange([])}>
                  清空
                </button>
              </div>
              <ul className="history-list">
                {history.map((item) => (
                  <li key={item}>
                    <button type="button" className="history-chip" onClick={() => void runSearch(item)}>
                      {item}
                    </button>
                    <button
                      type="button"
                      className="chip-delete"
                      aria-label={`删除搜索记录 ${item}`}
                      onClick={() => onHistoryChange(history.filter((entry) => entry !== item))}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </dialog>
  )
}
