"use client"

import { Hero } from "@/components/ui/hero"
import { Navbar } from "@/components/ui/navbar"
import { ModelsSection } from "@/components/ui/models-section"
import { Footer } from "@/components/ui/footer"

export default function Home() {
  const goToChat = () => {
    window.location.href = "/chat"
  }
  const handleEarlyAccess = goToChat
  const handleModelClick = () => goToChat()

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
