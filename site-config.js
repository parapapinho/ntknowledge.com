/* Configuração do blog. Cadastre cada novo arquivo Markdown em posts. */
window.siteConfig = {
  title: "NT Knowledge",
  description: "Reversing engineering, Windows and Vulnerability Research.",
  discord: "https://discord.com/users/everdoh",
  email: "parapapinho@gmail.com", // Preencha com seu e-mail público quando quiser exibi-lo.
  github: "https://github.com/parapapinho",
  x: "https://x.com/FxOliveir4",
  cvUrl: "assets/cv.pdf",
  posts: [
    {
      title: "Unpacking Enigma Protector 7.40 Like the Old Days: Bypassing Anti-Debugging, Finding the OEP, and Rebuilding the IAT",
      slug: "unpacking-enigma-protector-7-40",
      date: "2026-10-07",
      path: "posts/unpacking-enigma-protector-7-40.md"
    },
    {
      title: "The Breakpoint I Never Set: How IDA's F8 Triggered an Anti-Debug Check",
      slug: "ida-f8-hardware-breakpoint",
      date: "2026-09-29",
      path: "posts/ida-f8-hardware-breakpoint.md"
    }
  ]
};
