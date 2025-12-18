'use client'

import { InteractiveForm } from './InteractiveForm'
import { ButtonStates } from './ButtonStates'
import { DataTable } from './DataTable'
import { ModalTrigger } from './ModalTrigger'
import { NotificationStack } from './NotificationStack'
import { LoadingPatterns } from './LoadingPatterns'
import { CardVariants } from './CardVariants'
import styles from './samples.module.css'

export function Showcase() {
  return (
    <div className={styles.showcase}>
      <div className={`${styles.showcaseSection} animate-emerge delay-1`}>
        <h3 className={styles.showcaseSectionTitle}>Interactive Form</h3>
        <div className={styles.sampleCard}>
          <InteractiveForm />
        </div>
      </div>

      <div className={`${styles.showcaseSection} animate-emerge delay-2`}>
        <h3 className={styles.showcaseSectionTitle}>Button States</h3>
        <div className={styles.sampleCard}>
          <ButtonStates />
        </div>
      </div>

      <div className={`${styles.showcaseSection} animate-emerge delay-3`}>
        <h3 className={styles.showcaseSectionTitle}>Data Table</h3>
        <div className={styles.sampleCard}>
          <DataTable />
        </div>
      </div>

      <div className={`${styles.showcaseSection} animate-emerge delay-4`}>
        <h3 className={styles.showcaseSectionTitle}>Modal Dialog</h3>
        <div className={styles.sampleCard}>
          <ModalTrigger />
        </div>
      </div>

      <div className={`${styles.showcaseSection} animate-emerge delay-5`}>
        <h3 className={styles.showcaseSectionTitle}>Notifications</h3>
        <div className={styles.sampleCard}>
          <NotificationStack />
        </div>
      </div>

      <div className={`${styles.showcaseSection} animate-emerge delay-6`}>
        <h3 className={styles.showcaseSectionTitle}>Loading States</h3>
        <div className={styles.sampleCard}>
          <LoadingPatterns />
        </div>
      </div>

      <div className={`${styles.showcaseSection} animate-emerge delay-7`}>
        <h3 className={styles.showcaseSectionTitle}>Card Variants</h3>
        <div className={styles.sampleCard}>
          <CardVariants />
        </div>
      </div>
    </div>
  )
}
