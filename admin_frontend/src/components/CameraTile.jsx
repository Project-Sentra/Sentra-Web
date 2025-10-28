import React from "react";

export default function CameraTile({ title = "Cam 01" }) {
  return (
    <div className="rounded-xl bg-[#161616] border border-[#232323] h-44 text-gray-400 p-4">
      {title}
    </div>
  );
}
