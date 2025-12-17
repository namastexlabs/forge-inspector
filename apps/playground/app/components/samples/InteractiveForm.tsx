'use client'

import { useState } from 'react'
import styles from './samples.module.css'

interface FormData {
  name: string
  email: string
  password: string
}

interface FormErrors {
  name?: string
  email?: string
  password?: string
}

export function InteractiveForm() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 3000)
    }
  }

  const handleReset = () => {
    setFormData({ name: '', email: '', password: '' })
    setErrors({})
    setSubmitted(false)
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formField}>
        <label className={styles.formLabel} htmlFor="name">
          Full Name
        </label>
        <input
          id="name"
          type="text"
          className={`${styles.formInput} ${errors.name ? styles.formInputError : ''}`}
          placeholder="Enter your name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        {errors.name && <span className={styles.formError}>{errors.name}</span>}
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel} htmlFor="email">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          className={`${styles.formInput} ${errors.email ? styles.formInputError : ''}`}
          placeholder="you@example.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
        {errors.email && <span className={styles.formError}>{errors.email}</span>}
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className={`${styles.formInput} ${errors.password ? styles.formInputError : ''}`}
          placeholder="Min. 8 characters"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        />
        {errors.password && <span className={styles.formError}>{errors.password}</span>}
      </div>

      {submitted && (
        <span className={styles.formSuccess}>Form submitted successfully!</span>
      )}

      <div className={styles.formActions}>
        <button type="submit" className={`${styles.sampleButton} ${styles.sampleButtonPrimary}`}>
          Submit
        </button>
        <button type="button" className={styles.sampleButton} onClick={handleReset}>
          Reset
        </button>
      </div>
    </form>
  )
}
