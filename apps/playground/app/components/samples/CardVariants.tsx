'use client'

import styles from './samples.module.css'

interface CardProps {
  title: string
  description: string
}

function Card({ title, description }: CardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.cardImage} />
      <h4 className={styles.cardTitle}>{title}</h4>
      <p className={styles.cardDescription}>{description}</p>
    </div>
  )
}

export function CardVariants() {
  return (
    <div className={styles.cardGrid}>
      <Card
        title="Feature One"
        description="A brief description of this feature."
      />
      <Card
        title="Feature Two"
        description="Another feature description here."
      />
      <Card
        title="Feature Three"
        description="One more feature to showcase."
      />
      <Card
        title="Feature Four"
        description="Final card in this grid layout."
      />
    </div>
  )
}
