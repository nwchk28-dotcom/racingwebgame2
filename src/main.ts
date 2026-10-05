import { isWebApp } from './appMode';
import './style.css';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

async function launch(): Promise<void> {
  if (isWebApp()) {
    await import('./game');
    return;
  }
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
    <main class="install-gate">
      <div class="install-card">
        <div class="brand"><span class="brand-mark">A<span>1</span></span><span class="brand-name">APEX <strong>ONE</strong><small>TIME ATTACK</small></span></div>
        <p class="install-eyebrow">HOME SCREEN EDITION</p>
        <h1>ホーム画面から、<br><em>コースへ。</em></h1>
        <p class="install-lead">APEX ONEはWebアプリ専用です。ホーム画面に追加して、アプリのアイコンから起動してください。</p>
        <p class="install-benefit">ブラウザのバーが隠れ、横画面いっぱいで運転できます。</p>
        <div class="install-instructions">
          <section><h2>iPhone / iPad</h2><p>Safariでこのページを開く → 共有 →「ホーム画面に追加」→「追加」。<br>「Webアプリとして開く」が表示されたらオンにします。</p></section>
          <section><h2>Android</h2><p>Chromeの︙メニュー →「ホーム画面に追加」→「インストール」。</p></section>
          <section><h2>PC / Mac</h2><p>Chrome / Edgeのアドレスバーのインストールアイコンから追加。MacのSafariは「ファイル」→「Dockに追加」。</p></section>
        </div>
        <button id="install-app" class="primary-button" type="button" hidden>WEBアプリをインストール <span>↗</span></button>
        <p id="install-status" role="status">追加後は、このブラウザタブではなくアプリのアイコンを開いてください。</p>
      </div>
    </main>`;
  let prompt: InstallPrompt | null = null;
  const button = app.querySelector<HTMLButtonElement>('#install-app')!;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    prompt = event as InstallPrompt;
    button.hidden = false;
  });
  button.addEventListener('click', async () => {
    if (!prompt) return;
    button.disabled = true;
    const pending = prompt;
    prompt = null;
    try {
      await pending.prompt();
      const { outcome } = await pending.userChoice;
      app.querySelector('#install-status')!.textContent = outcome === 'accepted'
        ? '追加しました。ホーム画面またはアプリ一覧のAPEX ONEを開いてください。'
        : 'メニューからも追加できます。追加後にアプリのアイコンを開いてください。';
    } catch {
      app.querySelector('#install-status')!.textContent = 'ブラウザのメニューから追加してください。';
    } finally {
      button.hidden = true;
      button.disabled = false;
    }
  });
  window.addEventListener('appinstalled', () => {
    button.hidden = true;
    app.querySelector('#install-status')!.textContent = '追加しました。APEX ONEのアイコンから起動してください。';
  });
}

// Register after attaching the install-prompt listener. Browser visitors never
// initialize WebGL, controls or the game loop.
void launch();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,
      { scope: import.meta.env.BASE_URL }).catch(() => {
      const status = document.querySelector('#install-status');
      if (status) status.textContent = '読み込みを確認できませんでした。通信環境を確認して再読み込みしてください。';
    });
  });
}
