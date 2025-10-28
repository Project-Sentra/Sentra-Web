import React from "react";
import { Link } from "react-router";
import logoMain from "../assets/logo_main.png";

export default function Home() {
  return (
    <div className="text-white bg-sentraBlack font-poppins font-medium text-2xl flex items-center justify-center h-screen">
      <div className="flex flex-col gap-5">
        <p className="font-normal italic text-sm mb-10">
          This page is for development purpose only. Home page UI will
          implemented later.
        </p>
        <img src={logoMain} alt="main logo" className="w-75 mb-3" />
        <Link to={"/signin"}>
          Sign in page <span className="text-sentraYellow ">→</span>
        </Link>
        <Link to={"/signup"}>
          Sign up page <span className="text-sentraYellow ">→</span>
        </Link>
      </div>
    </div>
  );
}
