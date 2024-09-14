import React, { useCallback } from "react";

const Page = () => {
  const onChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    async (event) => {
      if (event.currentTarget.files) {
        const file = event.currentTarget.files[0];
        const txt = await file.text();
        const json = JSON.parse(txt);
        for (const article of json) {
          await fetch("/api/article/create", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: article.page_id,
            }),
          });
        }
      }
    },
    []
  );
  return (
    <div>
      <input type="file" onChange={onChange}></input>
    </div>
  );
};

export default Page;
