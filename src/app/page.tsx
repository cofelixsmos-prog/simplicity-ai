"use client"

import { useRouter } from "next/navigation"
import { Hero } from "@/components/ui/hero"
import { Navbar } from "@/components/ui/navbar"
import { ModelsSection } from "@/components/ui/models-section"
import { Footer } from "@/components/ui/footer"

export default function Home() {
  const router = useRouter()
  // Client-side nav (no full reload) straight to sign-up — avoids the slow
  // window.location reload and the /chat -> /login bounce.
  const handleEarlyAccess = () => router.push("/register")
  const handleModelClick = () => router.push("/register")

  return (
    <>
      <Navbar onCtaClick={handleEarlyAccess} />
      <Hero
        words={[
          "distilled",
          "pure",
          "simple",
          "genuine",
          "casual",
          "honest",
          "effortless",
        ]}
        buttonText="Get early access"
        onButtonClick={handleEarlyAccess}
      />
      <ModelsSection onModelClick={handleModelClick} />
      <Footer />
    </>
  )
}
