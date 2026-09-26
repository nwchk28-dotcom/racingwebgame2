# APEX ONE

1台で走る、オンボード視点のフォーミュラ・タイムアタックです。NOVA CIRCUIT、Monza、Silverstoneの3コースを選べます。車体と周辺施設は独自のデザインです。

## ローカル実行

```sh
npm ci
npm run dev
```

`npm run build` で静的ファイルを `dist/` に作成します。`npm run test` で周回判定を確認できます。

## 操作

- スマホ: 横向きにして、左のスライダーで操舵、右のペダルで加速と制動
- PC: A/D または左右矢印で操舵、W/上矢印で加速、S/下矢印で制動
- Esc: 一時停止、R: スタート地点にリセット
- 右上の音符ボタン: エンジン音のオン・オフ
- スタート画面でコースを選択。一時停止画面の「SELECT CIRCUIT」から戻れます

縁石の外端まではコース内です。4輪すべてが外に出るか、逆走、外周の円形ガードレールへの接触があった周回はベストタイムに記録されません。コースアウトしてもグリップや加減速は変わりません。記録はコース別にそのブラウザの `localStorage` に保存され、従来のNOVA記録も引き継がれます。

## コース形状

MonzaとSilverstoneの中心線は [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) のMITライセンスのデータを加工したものです。出典とライセンス全文は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) に記載しています。コース全長はそれぞれ5.793 kmと5.891 kmを目標とし、走行しやすい幅の路面・縁石・独自の周辺施設を生成しています。公式のコース図やロゴはゲーム内に収録していません。

## エンジン音

実車のエンジン録音を使用しています。音源は [Edvvc / Ed Pond, “Red-Bull-Cosworth-STR1-2006-David-Coulthard.ogg”](https://commons.wikimedia.org/wiki/File:Red-Bull-Cosworth-STR1-2006-David-Coulthard.ogg)（[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)）。Goodwood Festival of Speedでのコース脇からの録音で、オンボード録音ではありません。Wikimedia CommonsのMP3変換版を収録し、再生時に周期の安定した部分から波形を作ります。録音の時間経過は再生せず、車速とギアから音程を決めています。音源ファイルとその改変部分はCC BY-SA 3.0で利用できます。

## GitHub Pages

リポジトリをGitHubへプッシュし、Settings → Pages → Build and deployment → Sourceを **GitHub Actions** に設定してください。`main` へのプッシュでテスト、ビルド、公開が実行されます。`vite.config.ts` がリポジトリ名に合わせて公開パスを設定します。バックエンドは不要です。
