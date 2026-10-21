import { useEffect, useMemo, useRef, useState } from 'react'
import { PROVINCE_DATA, findCity, type City } from '../core/cities'

interface CityDialogProps {
  open: boolean
  value: City
  onClose: () => void
  onConfirm: (city: City) => void
}

function locateCity(name: string): { provIdx: number; cityIdx: number } {
  for (let provIdx = 0; provIdx < PROVINCE_DATA.length; provIdx += 1) {
    const cityIdx = PROVINCE_DATA[provIdx]?.cities.indexOf(name) ?? -1
    if (cityIdx >= 0) return { provIdx, cityIdx }
  }
  return { provIdx: 0, cityIdx: 0 }
}

export default function CityDialog({ open, value, onClose, onConfirm }: CityDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [provIdx, setProvIdx] = useState(0)
  const [cityIdx, setCityIdx] = useState(0)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    const located = locateCity(value.name)
    setProvIdx(located.provIdx)
    setCityIdx(located.cityIdx)
  }, [open, value.name])

  const cities = useMemo(() => PROVINCE_DATA[provIdx]?.cities ?? [], [provIdx])

  function confirm(): void {
    const name = cities[cityIdx]
    const city = name ? findCity(name) : null
    if (city) onConfirm(city)
  }

  return (
    <dialog
      ref={dialogRef}
      className="city-dialog"
      aria-labelledby="city-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="city-card">
        <h2 id="city-dialog-title">选择城市</h2>
        <div className="city-selects">
          <label>
            <span>省份</span>
            <select
              value={provIdx}
              onChange={(event) => {
                setProvIdx(Number(event.target.value))
                setCityIdx(0)
              }}
            >
              {PROVINCE_DATA.map((province, index) => (
                <option key={province.prov} value={index}>
                  {province.prov}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>城市</span>
            <select value={cityIdx} onChange={(event) => setCityIdx(Number(event.target.value))}>
              {cities.map((city, index) => (
                <option key={city} value={index}>
                  {city}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn primary" onClick={confirm}>
            确定
          </button>
        </div>
      </div>
    </dialog>
  )
}
