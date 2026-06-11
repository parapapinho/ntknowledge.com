# Prefácio

> [!NOTA]
> Rascunho inicial — ajuste livremente. Este é um ponto de partida para você reescrever com a sua voz.

This book is about building software on Windows 11 and about understanding the security model that everything on the platform ultimately rests on. The two subjects are treated as one because, in practice, they are inseparable: every process you create, every file you open, every handle you pass between components is mediated by the same access-control machinery, and a program that ignores it is not merely insecure — it is incompletely understood. The aim is to build that understanding from the ground up, with realistic examples rather than isolated function listings.

The target throughout is Windows 11 and its 64-bit Win32/Win64 API — the native programming layer beneath the higher-level stacks most developers use day to day, modern .NET included. On the programming side, the focus is the core system services that real software depends on: the file system, process and thread management, interprocess communication, networking, and synchronization. On the security side, it covers the mechanisms that govern who can do what: the security reference monitor, access tokens, security descriptors and ACLs, privileges, integrity levels, and the boundaries that isolate one process from another.

This is a comprehensive reference, meant to be read in depth and returned to often. It explains the essential behavior of the most important functions and, more importantly, shows how to combine them in working programs — then turns the same lens on how those programs can fail and how to harden them. The work is intended to grow over time, and it is written to remain useful as it does.
