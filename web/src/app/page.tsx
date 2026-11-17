import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Bouléplan</h1>
      <p className={styles.subtitle}>Gerenciador pessoal de iniciativas e tarefas.</p>
    </main>
  );
}
