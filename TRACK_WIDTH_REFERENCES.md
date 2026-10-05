# 道幅の出典と実装（2026-10-05）

単位はアスファルトの全幅 m。縁石・ランオフ・ピットレーンは含めない。
1 world unit = 1 m。全24コースの従来の一定幅を見直した。

## 判断方法と限界

[FIA licensed circuits, 2025-12-01](https://www.fia.com/sites/default/files/circuits_fia20251201.pdf)
の **REFERENCE WIDTH** を全24コースの共通照合元にした。
これは基準幅であり、全周の平均幅、最大幅、最小幅、または各地点の実測幅を表すものとして扱わない。
運営者・主催者の具体的な幅や範囲が見つかったコースはそちらを優先。
それ以外は FIA 基準幅を暫定的な一定幅として採用する。
従来はほとんど19 m幅で、実際より広いコースも多かった。

幅の範囲だけが公表されている場合、全周にその最大値を適用しない。
セパン・上海・バクーには幅変化を実装。周回距離に対する変化点と遷移長は
ゲーム中心線と公開地図からの**近似**で、測量済みの路面端ではない。
特にセパンの22 m区間の正確な始終点は運営者資料から確定できない。
残るコースの局所的な拡幅・狭窄は、この一定幅モデルでは再現していない。

| コース | 従来 | 今回の幅 | 採用根拠 |
| --- | ---: | ---: | --- |
| Monza | 19 | 11 | 運営者10–12の中間値 |
| Silverstone | 19 | 15 | 2025主催者のGPレイアウト資料 |
| Albert Park | 19 | 11 | FIA基準幅 |
| Mexico City | 19 | 14 | FIA基準幅 |
| Gilles-Villeneuve | 19 | 10 | FIA基準幅 |
| Monaco | 12 | 10 | FIA基準幅。ヘアピンなどの局所幅は未測量 |
| Spa | 19 | 12.5 | ACO主催者資料11–14の中間値 |
| São Paulo | 19 | 10 | FIA基準幅 |
| Jeddah | 15 | 12 | FIA基準幅。メディアキットの10–15内 |
| Baku | 12.4 | 7.6–13 | 都市当局の資料。T7–T8旧市街で7.6、直線13、他12 |
| Yas Marina | 19 | 12 | FIA基準幅 |
| Singapore | 15 | 9 | FIA基準幅。広い区間の実測値未取得 |
| Shanghai | 19 | 通常14／T13付近20 | 公的資料の通常13–15、T13で20 |
| Bahrain | 19 | 13 | FIA GPレイアウト基準幅 |
| Miami | 17 | 12 | FIA基準幅 |
| Imola | 17 | 10 | FIA基準幅 |
| Barcelona | 19 | 11 | FIA基準幅 |
| Red Bull Ring | 19 | 12 | FIA基準幅 |
| Hungaroring | 18 | 13 | 運営者10–16の中間値 |
| Zandvoort | 17 | 10 | FIA基準幅 |
| Austin | 19 | 13 | FIA基準幅 |
| Las Vegas | 16 | 13 | FIA基準幅。2024メディアキットの12–15内 |
| Lusail | 19 | 12 | FIA基準幅 |
| Sepang | 18 | 16–22 | 運営者の最小16／最大22。2本の主要直線を拡幅 |

## 具体的な幅の一次資料

- [Monza運営者](https://www.monzanet.it/en/circuit/): 10–12 m。
- [Silverstone 2025主催者資料](https://docs.msv.com/BTC%20Silverstone%202025%20Final%20Info%20ALL.pdf): p5のGPレイアウト15 m。F1とMotoGPのコース全長差は幅情報に流用しない。
- [Spa ACO/ELMSメディアガイド](https://press.lemanscup.com/assets/fileuploads/64/2a/642a9e394534c.pdf): 11–14 m。
- [Hungaroring運営者](https://hungaroring.hu/guidebook/): 10–16 m。旧ガイドのため全地点の現行実測値ではない。
- [Baku都市当局](https://bulvar.gov.az/en/news/formula-1-azarkeshleri-baki-bulvarinda): 最大13 m、T7–T8間最小7.6 m。
- [Shanghai概要・クイーンズランド議会公文書](https://www.parliament.qld.gov.au/Work-of-the-Assembly/Tabled-Papers/docs/5104T1091/5104t1091.pdf): 通常13–15 m、T13で20 m。2004年の資料で、最新の路面端測量ではない。
- [Sepang運営者](https://www.sepangcircuit.com/architecture): 最小16 m／最大22 m。
- [Jeddah FIAメディアキット](https://www.fia.com/sites/default/files/final_saudi_media_kit_20211130_.pdf): 10–15 m。
- [Las Vegas FIA 2024メディアキット](https://api.fia.com/sites/default/files/2024-officialmediakit_booklet-digital-11.15.24.pdf): 12–15 m。

## 車と判定の整合性

旧モデルの最大幅3.08 mを2 mに補正。2025年型を参考にした架空車両で、
[FIA 2025技術規則3.4.1](https://www.fia.com/system/files/documents/fia_2025_formula_1_technical_regulations_-_issue_02_-_2025-02-26.pdf)
の車体Y=±1000 mmを参考にした。規則に基づく車体全体の再現ではない。
カメラの高さ・画角・走行モデルは維持し、車体横寸法、タイヤ位置、接触判定を合わせた。

路面・白線・縁石・壁は共通の地点別幅を参照。全輪コースアウト判定は
各タイヤ位置でその地点の縁石外端を参照する。幅は滑らかに遷移し、計時線でも連続する。
近接するコース間の共有壁・ヘアピン内側の折り返し対策を維持。

確認: 全24コースの路面端/縁石の前後連続性、路面描画と判定幅の一致、
壁との走行余裕、2 mモデル幅、全輪脱落、幅変化地点、コース方向・スタート位置の回帰テスト。
音源・画像などの大型資産追加はなく、GitHub Pages向け静的ビルドを維持。
既存のブラウザ内ベストタイムは消去していない。
