"use client";

import React, { useState } from "react";

export default function TwoFALoginPage() {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [showBackupCodes, setShowBackupCodes] = useState<string[] | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    setMsg("");

    try {
      const res = await fetch("/api/2fa/login-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // <- ここが重要（HttpOnly cookie を送る）
        body: JSON.stringify({ code }),
      });

      // ステータス別ハンドリング（デバッグしやすく）
      if (res.status === 401) {
        setMsg("保留中の2FA情報が見つかりません（セッションが切れている可能性があります）。再度ログインしてください。");
        setIsBusy(false);
        return;
      }
      if (res.status === 400) {
        const body = await res.json().catch(() => ({}));
        setMsg(body?.message ?? "コードが無効です。");
        setIsBusy(false);
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setMsg(`サーバエラー: ${res.status} ${text}`);
        setIsBusy(false);
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (data.success) {
        if (data.backupCodes) {
          setShowBackupCodes(data.backupCodes);
          setMsg("2FA を有効化しました。バックアップコードを必ず保存してください。");
        } else {
          setMsg("ログイン完了。リダイレクトします...");
          // 安全にトップへ戻す
          window.location.href = "/";
        }
      } else {
        setMsg(data.message ?? "認証に失敗しました");
      }
    } catch (err) {
      console.error("fetch error:", err);
      setMsg("ネットワークエラーが発生しました。コンソールを確認してください。");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="flex flex-col items-center mt-10">
      <h1 className="text-xl font-bold">2段階認証コードの入力</h1>
      {!showBackupCodes ? (
        <form
          onSubmit={handleVerify}
          className="mt-4 flex flex-col items-center gap-2"
        >
          <input
            inputMode="numeric"
            pattern="\d*"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
            className="border px-2 py-1 rounded text-center"
            placeholder="6桁コード or バックアップコード"
            aria-label="2FAコード"
            disabled={isBusy}
          />
          <button className="border rounded px-4 py-1" disabled={isBusy}>
            {isBusy ? "検証中..." : "送信"}
          </button>
        </form>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="font-bold">{msg}</p>
          <ul className="mt-2 space-y-1">
            {showBackupCodes.map((c, i) => (
              <li key={i} className="font-mono bg-gray-100 px-2 py-1 rounded">
                {c}
              </li>
            ))}
          </ul>
          <button
            className="mt-4 border rounded px-4 py-1 bg-blue-500 text-white hover:bg-blue-600"
            onClick={() => (window.location.href = "/")}
          >
            ホームに戻る
          </button>
        </div>
      )}
      {!showBackupCodes && msg && <p className="mt-2">{msg}</p>}
    </main>
  );
}
