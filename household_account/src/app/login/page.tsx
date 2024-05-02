import Image from "next/image";

export default function Home() {
  return (
    <>
      <h2> ログイン画面</h2>
      <div>
        <p>ID</p>
        <input type="text" name="ID"></input>
      </div>
      <div>
        <p>Password</p>
        <input type="password" name="password"></input>
      </div>
      <div>
        <button type="button" name="login">login</button>
      </div>
      <div>
        <button type="button" name="create">アカウント作成</button>
      </div>
    </>
  );
}
