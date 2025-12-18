'use client'

import { useState } from 'react'
import styles from './samples.module.css'

interface TableRow {
  id: number
  name: string
  status: string
  date: string
}

const initialData: TableRow[] = [
  { id: 1, name: 'Project Alpha', status: 'Active', date: '2024-01-15' },
  { id: 2, name: 'Project Beta', status: 'Pending', date: '2024-01-12' },
  { id: 3, name: 'Project Gamma', status: 'Complete', date: '2024-01-10' },
]

export function DataTable() {
  const [data, setData] = useState(initialData)
  const [selected, setSelected] = useState<number[]>([])
  const [sortKey, setSortKey] = useState<keyof TableRow>('id')
  const [sortAsc, setSortAsc] = useState(true)

  const handleSort = (key: keyof TableRow) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }

    setData([...data].sort((a, b) => {
      const aVal = a[key]
      const bVal = b[key]
      if (aVal < bVal) return sortAsc ? -1 : 1
      if (aVal > bVal) return sortAsc ? 1 : -1
      return 0
    }))
  }

  const handleSelect = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selected.length === data.length) {
      setSelected([])
    } else {
      setSelected(data.map((row) => row.id))
    }
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={`${styles.tableHeader} ${styles.tableCellCheckbox}`}>
            <input
              type="checkbox"
              className={styles.tableCheckbox}
              checked={selected.length === data.length}
              onChange={handleSelectAll}
            />
          </th>
          <th
            className={`${styles.tableHeader} ${sortKey === 'name' ? styles.tableHeaderSorted : ''}`}
            onClick={() => handleSort('name')}
          >
            Name {sortKey === 'name' && (sortAsc ? '↑' : '↓')}
          </th>
          <th
            className={`${styles.tableHeader} ${sortKey === 'status' ? styles.tableHeaderSorted : ''}`}
            onClick={() => handleSort('status')}
          >
            Status {sortKey === 'status' && (sortAsc ? '↑' : '↓')}
          </th>
          <th
            className={`${styles.tableHeader} ${sortKey === 'date' ? styles.tableHeaderSorted : ''}`}
            onClick={() => handleSort('date')}
          >
            Date {sortKey === 'date' && (sortAsc ? '↑' : '↓')}
          </th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr
            key={row.id}
            className={`${styles.tableRow} ${selected.includes(row.id) ? styles.tableRowSelected : ''}`}
          >
            <td className={`${styles.tableCell} ${styles.tableCellCheckbox}`}>
              <input
                type="checkbox"
                className={styles.tableCheckbox}
                checked={selected.includes(row.id)}
                onChange={() => handleSelect(row.id)}
              />
            </td>
            <td className={styles.tableCell}>{row.name}</td>
            <td className={styles.tableCell}>{row.status}</td>
            <td className={styles.tableCell}>{row.date}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
