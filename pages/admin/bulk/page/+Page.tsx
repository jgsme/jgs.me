import React, { useCallback } from "react";

const Page = () => {
  const onChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    async (event) => {
      if (event.currentTarget.files) {
        const file = event.currentTarget.files[0];
        const txt = await file.text();
        const json = JSON.parse(txt);
        for (const page of json) {
          await fetch("/api/page/create", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: page.title,
              created: page.created,
              updated: page.updated,
              image: page.image,
              sbID: page.id,
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
