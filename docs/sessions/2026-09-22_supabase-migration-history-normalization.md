# 2026-09-22 — Supabase migration 履歴正常化

## 目的と安全条件

- 本番 `HouseholdAccount-tokyo`（project ref `bkljkdkldaiemwpnjuks`）の既存 schema・実データは変更しない。
- 既存の remote migration 履歴 21 件は削除・更新しない。
- 直接 SQL で適用済みの 0022〜0025 だけを、公式 CLI の
  `migration repair --status applied` で履歴へ追加する。
- migration SQL は再実行しない。異常時のロールバックも
  `migration repair --status reverted` に限定する。

## 修復前履歴と対応表

`supabase_migrations.schema_migrations` から version・name・statement 数・
statement MD5 を読み取った。`created_by` 等の個人情報は記録しない。

| 論理ID | 修復前 local file | remote version | remote name | remote statements MD5 | 根拠 |
|---|---|---|---|---|---|
| 0001 | `0001_initial_schema.sql` | `20260618212503` | `0001_initial_schema` | `0feb3d29e0e05516bd8c048f5155adda` | SQL一致 |
| 0002 | `0002_rls_policies.sql` | `20260618212518` | `0002_rls_policies` | `4a2abefb645635b84e001f0c2a1161ac` | SQL一致 |
| 0003 | `0003_household_bootstrap.sql` | `20260618212528` | `0003_household_bootstrap` | `ed76c6340e45687166b6b120969a1238` | SQL一致 |
| 0004 | `0004_household_invitations.sql` | `20260618212540` | `0004_household_invitations` | `9b0a1b5195c1b8ce3ae17d858fd7c990` | SQL一致 |
| 0005 | `0005_invitation_preview.sql` | `20260618212548` | `0005_invitation_preview` | `95118c5a6df4afceb8b4d998484c5006` | SQL一致 |
| 0006 | `0006_harden_function_grants.sql` | `20260618212557` | `0006_harden_function_grants` | `00d9f056848242c950bda74947ef5f8f` | SQL一致 |
| 0007 | `0007_revoke_anon_from_helpers.sql` | `20260618212603` | `0007_revoke_anon_from_helpers` | `fad8cab09a8af278f8bd7ae46ec30537` | SQL一致 |
| 0008 | `0008_household_period_start_day.sql` | `20260618212611` | `0008_household_period_start_day` | `c1e1b2009a2936083d6e471a3fbc72f4` | SQL一致 |
| 0009 | `0009_profiles.sql` | `20260618212620` | `0009_profiles` | `958b8a3f2f529b373441be4854589466` | SQL一致 |
| 0010 | `0010_profiles_update_policy.sql` | `20260618212626` | `0010_profiles_update_policy` | `84f0e770b427fa64c4922602163eabd0` | SQL一致 |
| 0011 | `0011_revoke_rls_auto_enable.sql` | `20260618212643` | `0011_revoke_rls_auto_enable` | `f0d955c890bdd1daf6738a0a68e9f8e9` | 承認済み差分（下記） |
| 0012 | `0012_delete_own_account.sql` | `20260618212650` | `0012_delete_own_account` | `e1a1bbc6a4997f116ab18a98a909e93b` | SQL一致 |
| 0013 | `0013_transfer_ownership.sql` | `20260618212658` | `0013_transfer_ownership` | `770def9fa78b4a6f4f0ff05602ce0a78` | SQL一致 |
| 0014 | `0014_rls_initplan.sql` | `20260618212707` | `0014_rls_initplan` | `0300085a87ed64efc87d4dd9380b3546` | SQL一致 |
| 0015 | `0015_move_helpers_to_private.sql` | `20260618212726` | `0015_move_helpers_to_private` | `e9fa4f8d3725b92b87b0b35ba41b034b` | SQL一致 |
| 0016 | `0016_performance_indexes.sql` | `20260618234824` | `performance_indexes` | `8b19861f3ceefcce76335cc030f8031a` | SQL一致 |
| 0017 | `0017_member_display_name.sql` | `20260622212454` | `0017_member_display_name` | `6195480611d2f3328f29ff70d7848b3a` | SQL一致 |
| 0018 | `0018_recurring_transactions.sql` | `20260625220051` | `0018_recurring_transactions` | `ed00f25a1f2b49efd76a01ab90fab892` | 承認済み差分（下記） |
| 0019 | `0019_budgets.sql` | `20260628140554` | `0019_budgets` | `7a11461f17a1accbbbab0be28ee7bad5` | SQL一致 |
| 0020 | `0020_savings_goals.sql` | `20260629213456` | `savings_goals` | `02c717aeacb180e36d7dc9f682b446e0` | SQL一致 |
| 0021 | `0021_member_settlement.sql` | `20260703151808` | `member_settlement` | `39b23a21929a1a9bbaa50983952f0e2a` | SQL一致 |
| 0022 | `0022_category_reminder.sql` | なし | なし | なし | 直接適用記録＋schema marker |
| 0023 | `0023_architecture_hardening.sql` | なし | なし | なし | 直接適用記録＋schema marker |
| 0024 | `0024_transaction_on_behalf_of.sql` | なし | なし | なし | 直接適用記録＋schema marker |
| 0025 | `0025_distributed_rate_limits.sql` | なし | なし | なし | 直接適用記録＋schema marker・権限検査 |

SQL一致はコメントと空白を除去したハッシュでも一致することを確認した（19/21件）。

### 0011・0018 の承認済み差分

- 0011: remote保存SQLは `pg_proc.proname` で存在確認し、local現行SQLは
  `to_regprocedure('public.rls_auto_enable()')` でシグネチャまで確認する。
  本番には対象関数が存在しないため、最終状態は等価である。
- 0018: remote保存SQLには `generate_due_recurring(uuid)` の `anon` に対する
  明示REVOKEがなく、local現行SQLには防御的なREVOKEがある。本番の最終権限は
  `anon=false`、`authenticated=true`、`service_role=true` である。
- ユーザー承認により、上記2件はlocal現行SQLを正本とし、差分を履歴修復の例外として扱う。
  適用済みSQLを書き換えたり再実行したりはしない。

## 0022〜0025 の version 根拠

一意性と元の作成順を保つため、各SQLの最終内容に対応するGit author時刻をUTCへ変換した。

| 論理ID | version | 根拠commit |
|---|---|---|
| 0022 | `20260709213238` | `fcd42419068fb7439188de40670ef57fb623567e` |
| 0023 | `20260716131725` | `5219bb95f6e550484261e53ad634bfe3da134791` |
| 0024 | `20260920074241` | `2c3978893ac6137abef91c679053894507fc9035` |
| 0025 | `20260921141735` | `97d74dd68499b2206905d363bda231cde9d8d0f4` |

## 実施コマンドとロールバック

履歴追加（schema・データ・migration SQLは変更しない）:

```sh
supabase migration repair --linked --status applied \
  20260709213238 20260716131725 20260920074241 20260921141735
```

異常時は追加した4行だけを公式CLIで戻す:

```sh
supabase migration repair --linked --status reverted \
  20260709213238 20260716131725 20260920074241 20260921141735
```

既存21件はどちらの操作でも対象にしない。

## 修復後の検証

修復完了後に、migration list、db push dry-run、schema marker、0025権限、
pgTAP 30件、Database CIの結果を追記する。
