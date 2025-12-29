import type { PageContextServer } from "vike/types";
import type { Bindings } from "@/server";

export type OnThisDayIndex = {
  years: number[];
  entries: {
    [mmdd: string]: [number, number][]; // [yearIndex, count]
  };
};

export type Data = {
  index: OnThisDayIndex;
};

type Context = PageContextServer & {
  env: Bindings;
};

const data = async (c: Context): Promise<Data> => {
  try {
    const object = await c.env.R2.get("on-this-day-index.json");
    console.log(object);
    if (object) {
      const index = await object.json<OnThisDayIndex>();
      console.log("Successfully loaded on-this-day index from R2");
      return { index };
    }
  } catch (e) {
    console.error("Error fetching on-this-day index from R2:", e);
  }

  return { index: { years: [], entries: {} } };
};

export default data;
