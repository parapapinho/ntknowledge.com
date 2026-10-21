## Introduction

In June 2026, ESET documented the use of Enigma and Themida in The Gentlemen's tools for disabling EDRs. The samples included a variant of GentleKiller protected with Enigma. [[1]](https://www.welivesecurity.com/en/eset-research/killing-me-gently-inside-gentlemens-edr-killer-framework/)

In 2025, Aryaka also reported the use of Enigma Protector in a campaign attributed to Kimsuky, listing it in the mapping of techniques at the end of the report. [[2]](https://www.aryaka.com/docs/reports/aryaka-kimsuky-apt-operational-blueprint.pdf) These examples show why knowing your way around a commercial protector still matters when analyzing malware.

Seeing malicious actors use it is what made me revisit Enigma and write this tutorial. Yes, I'm calling it a tutorial. When you're analyzing malware, getting past the protection can take up a good part of the work before you can even look at what the sample does. Understanding where the loader ends and the application's code begins helps you make sense of what you see in the debugger and distinguish the loader's behavior from the application's.

To follow along, **[download the protected executable (ZIP)](https://raw.githubusercontent.com/parapapinho/ntknowledge.com/main/assets/teste_protectd.EXE.zip)** and try the unpacking yourself.

## 1. Preparing the executable

To get started, I used Enigma x64 version 7.40.

> ![About window for Enigma Protector x64 7.40, build 20230424](/assets/images/enigma/eng1.png)

As you can see, Enigma has quite a few configuration options:

> ![Enigma Protector Input screen showing the input and output files and configuration categories](/assets/images/enigma/eng2.png)

For this test, I focused on the anti-debugging and API emulation options described in the Enigma manual. [[3]](https://www.enigmaprotector.com/en/help/manual/programoverview-checkup-antidebugger) [[4]](https://www.enigmaprotector.com/en/help/manual/programoverview-protectionfeatures-importprotection) The screenshots below show the settings I used:

> ![Anti-debugging options enabled, including runtime checks and a message before termination](/assets/images/enigma/eng3.png)

> ![Import Protection with Emulate WinAPI functions enabled and Redirect WinAPI functions disabled](/assets/images/enigma/eng4.png)

The Enigma installer includes a test executable, **test64.exe**, so I used that as my example. I protected it with the settings shown above and started debugging. I kept the unprotected original to compare the code and PE structures as I went along.

The first thing I like to do when debugging any program is run it and see whether anything goes wrong. I used IDA Pro 9.4 and x64dbg, both without anti-anti-debugging plugins. For reconstruction, I used Scylla x64 and PE-bear.

The addresses in the screenshots belong to their respective sessions. If you're following along, resolve the APIs in your own process and check the module bases; absolute addresses can change.

## 2. Getting detected

First, I ran the program in x64dbg. The **Debugger warning** dialog appeared right away. The initial import list contained **MessageBoxA**, but the breakpoint I set on that API wasn't hit before the warning appeared. Seeing the function in the import table wasn't enough to tell me how that message was being displayed.

> ![Debugger warning stating that the program will not run while a debugger is active](/assets/images/enigma/eng5.png)

> ![Import list in x64dbg with user32.MessageBoxA highlighted](/assets/images/enigma/eng6.png)

Well, I tried to get back to the program's code through the debugger, but I couldn't. So I paused execution and found a pointer to the string **CheckRemoteDebuggerPresent** in the stack view. According to Microsoft's documentation, this API checks whether the specified process is being debugged. [[5]](https://learn.microsoft.com/en-us/windows/win32/api/debugapi/nf-debugapi-checkremotedebuggerpresent) It was a good lead for a possible anti-debugging check, although the string alone didn't prove the function was being called. At least I had somewhere to start.

> ![Stack view with pointers to the strings kernel32.dll and CheckRemoteDebuggerPresent](/assets/images/enigma/eng7.png)

To confirm that **CheckRemoteDebuggerPresent** was being used, I set a software breakpoint on the API and tried a hardware breakpoint (HBP) in a separate run. The result caught my attention: with the software breakpoint, x64dbg logged the process exiting with code **0x80000003** (**STATUS_BREAKPOINT**); with the HBP, the code was **0x80000004** (**STATUS_SINGLE_STEP**).

These codes correspond to breakpoint and single-step exceptions, respectively. [[6]](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-exception_record) On x86/x64, a software breakpoint usually uses the **INT3** instruction; a hardware breakpoint can generate a single-step exception, as can stepping through the code. So these codes alone don't mean the program detected the debugger or inspected the breakpoints.

The screenshots below show the exit codes logged in both attempts:

> ![x64dbg log showing the process exiting with code 0x80000003, STATUS_BREAKPOINT](/assets/images/enigma/eng8.png)

> ![x64dbg log showing the process exiting with code 0x80000004, STATUS_SINGLE_STEP](/assets/images/enigma/eng9.png)

I suspected some kind of protection was interfering with debugging. The behavior was worth looking into, but I still needed to find out where the failure occurred and why I couldn't break on the API.

I wanted to confirm whether the exception occurred at the exact address where I had set the breakpoint on **kernel32!CheckRemoteDebuggerPresent**. To do that, I needed to distinguish two things: the **exception code**, which identifies its type, and the **exception address**, which tells us where it occurred. [[6]](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-exception_record)

Before resuming execution, I opened the **Log** tab in x64dbg, right-clicked, and selected **Redirect Log**. I chose a **.txt** file to save the new messages.

Then I configured exception breakpoints and log messages with the following commands:

```text
SetExceptionBPX 80000003, all
SetExceptionBreakpointLog 80000003, "CODE={x:ex.code()} ADDRESS={a:ex.addr()}"
SetExceptionBPX 80000004, all
SetExceptionBreakpointLog 80000004, "CODE={x:ex.code()} ADDRESS={a:ex.addr()}"
```

The **all** argument catches both first- and second-chance exceptions. [[7]](https://help.x64dbg.com/en/latest/commands/breakpoint-control/SetExceptionBPX.html) The messages log the code and address when the exception breakpoint is hit. [[8]](https://help.x64dbg.com/en/latest/commands/conditional-breakpoint-control/SetExceptionBreakpointLog.html)

But when I resumed execution with the breakpoint on the API, the application exited without giving me the exception address I expected in the log. The breakpoints were configured as shown below:

> ![Enabled breakpoints in x64dbg: CheckRemoteDebuggerPresent at 0x7FFAD8B15180 and exceptions 0x80000003 and 0x80000004](/assets/images/enigma/eng10.png)

If x64dbg stops on an exception, the **exinfo** command lets you inspect the last exception received by the debugger, including **ExceptionCode** and **ExceptionAddress**. [[9]](https://help.x64dbg.com/en/latest/commands/analysis/exinfo.html) Save that output before continuing. The command relies on exception information received by the debugger. In this run, the process terminated without the expected exception details appearing in the log.

Now what? I turned to the Windows event log. I repeated the test and opened **Event Viewer**, under **Windows Logs > Application**, to look for the crash report:

> ![Event 1000, Application Error, with exception 0x80000003 in KERNEL32.DLL and fault offset 0x45180](/assets/images/enigma/eng11.png)

The event identified **KERNEL32.DLL** as the faulting module, with exception code **0x80000003** and offset **0x45180**. That offset is relative to the loaded DLL's base, not the protected executable's base. In x64dbg, the entry address of **kernel32!CheckRemoteDebuggerPresent** also appeared at RVA **0x45180**:

> ![Disassembly of kernel32.CheckRemoteDebuggerPresent at address 0x7FFAD8B15180, with RVA 0x45180](/assets/images/enigma/eng12.png)

Using the base of **kernel32.dll** from that run, the calculation was:

```text
kernel32.dll base:   0x7FFAD8AD0000
Fault offset:              0x45180
Fault address:      0x7FFAD8B15180
```

The result matches the address where I set the breakpoint on the API. The crash report let me locate the exception even without the log I expected from x64dbg. That confirmed where the failure occurred in this test.

## 3. First obstacle: **ThreadHideFromDebugger**

The breakpoints on **CheckRemoteDebuggerPresent** were triggering an exception, but the debugger couldn't stop normally in that thread. That made me wonder: could the loader have hidden this thread, preventing its debug events from reaching the debugger?

To check, I wrote a Python script that takes a thread ID and queries whether the thread is hidden from the debugger. The script opens a handle with **OpenThread** and calls **NtQueryInformationThread**, passing the **ThreadHideFromDebugger** class (**0x11**). For this query, the output buffer receives a one-byte **BOOLEAN**: **1** means the thread is hidden; **0** means it isn't. Check the **NTSTATUS** returned by the call before interpreting this result. You can find the definition of this class in the phnt project's headers. [[10]](https://github.com/winsiderss/phnt/blob/master/ntpsapi.h)

First, I identified the main thread in x64dbg. Its ID in that run was **8196**:

> ![Thread list in x64dbg with the main thread, ID 8196, highlighted](/assets/images/enigma/eng13.png)

Then I ran the script to query that thread:

> ![Running query_hidden_thread.py for TID 8196, with NTSTATUS=0x00000000 and hidden=1](/assets/images/enigma/eng14.png)

The query returned **NTSTATUS=0x00000000** and **hidden=1**. That confirmed the main thread was hidden at that point. On the next run, I set a breakpoint on **ntdll!NtSetInformationThread** and caught the loader calling it with **RCX=-2**, the pseudo-handle for the current thread, and **RDX=0x11**, corresponding to **ThreadHideFromDebugger**:

> ![NtSetInformationThread entry with RCX=FFFFFFFFFFFFFFFE and RDX=0x11](/assets/images/enigma/eng15.png)

So I needed to stop this call from hiding the thread before I could break on **CheckRemoteDebuggerPresent**.

There were several ways to do that. I chose to replace the first three bytes of **NtSetInformationThread**, **in the debugged process's memory**, so the function would return success immediately:

```asm
ntdll!NtSetInformationThread
before: 4C 8B D1      ; mov r10,rcx
after:  31 C0 C3      ; xor eax,eax / ret
```

The **xor eax,eax** sets the return value to **STATUS_SUCCESS** (**0**), and **ret** returns control to the caller without making the system call. This patch doesn't filter for class **0x11**: while it's in place, any call through this entry point returns success without performing the operation.

The order matters here: apply the patch **before the thread is hidden**. It won't unhide a thread that's already been hidden. Since the change only exists in memory, you also need to reapply it after restarting the process.

I restarted the program, set two hardware execution breakpoints, one on **NtSetInformationThread** and the other on **CheckRemoteDebuggerPresent**, and continued execution:

> ![Enabled breakpoints on kernel32.CheckRemoteDebuggerPresent and the ntdll entry labeled ZwSetInformationThread](/assets/images/enigma/eng16.png)

In the screenshots, x64dbg labels the **ntdll** entry as **ZwSetInformationThread**. That's the label shown at the address I used for the patch.

At the first stop, I replaced the bytes at the function's entry point:

> ![NtSetInformationThread entry patched in memory to xor eax,eax followed by ret](/assets/images/enigma/eng17.png)

Then I continued execution. This time, I managed to break on **CheckRemoteDebuggerPresent**:

> ![Stopped at kernel32.CheckRemoteDebuggerPresent with RCX=-1 and RDX=0x23FFD08](/assets/images/enigma/eng18.png)

At this point, I noted the **value of RDX**, which was **0x23FFD08**. It pointed to the output **BOOL** where the API would write whether a debugger was present. This **BOOL** takes up four bytes, unlike the one-byte **BOOLEAN** used in the earlier query. [[11]](https://learn.microsoft.com/en-us/windows/win32/winprog/windows-data-types)

I continued to the **ret** shown below. By then, the API had already written **01 00 00 00** to the saved address, indicating that a debugger was present. Before returning to the caller, I changed those four bytes to **00 00 00 00**:

> ![Stopped at the ret in CheckRemoteDebuggerPresent in KERNELBASE, with the BOOL at 0x23FFD08 containing 01 00 00 00 before the change](/assets/images/enigma/eng19.png)

Make sure you save the pointer when entering the API: **RDX** is volatile and may hold a different value by the end of the call. [[12]](https://learn.microsoft.com/en-us/cpp/build/x64-calling-convention?view=msvc-170) Change the contents at the saved address, not the register. Keep the API's success return value: as the **CheckRemoteDebuggerPresent** documentation explains, the return value indicates whether the query succeeded; the answer about the debugger goes in the output **BOOL**. [[5]](https://learn.microsoft.com/en-us/windows/win32/api/debugapi/nf-debugapi-checkremotedebuggerpresent)

Finally, I continued execution, and the application's window opened under the debugger:

> ![The test application's Notepad window open under the debugger after the patch and the change to the output BOOL](/assets/images/enigma/eng20.png)

That got me past the initial check and let me open the program in this test. When enabled, the runtime check can still repeat the query. [[3]](https://www.enigmaprotector.com/en/help/manual/programoverview-checkup-antidebugger) We now know where to intervene, but changing one result doesn't affect later calls: each one needs to be handled.

## 4. Finding the program's OEP

After getting around the **CheckRemoteDebuggerPresent** check, the next step was to stop at the program's **Original Entry Point (OEP)** to take the dump and then rebuild the **Import Address Table (IAT)**.

In this case, I had the unprotected executable, so I already knew where its OEP was. That gave me a reference for confirming which jump in the Enigma loader reached it. The useful part here is the sequence that prepares that jump: once identified, it gives us a place to stop without having to recognize the startup code of each compiler.

I set a hardware execution breakpoint at **0x1002EAF78** and stopped at the sequence that prepares the jump:

> ![Sequence at 0x1002EAF78 that loads RAX, restores RSP, and executes jmp rax at 0x1002EAF80](/assets/images/enigma/eng21.png)

```asm
0x1002EAF78  mov rax, qword ptr [rbp-20h]
0x1002EAF7C  mov rsp, qword ptr [rbp-8]
0x1002EAF80  jmp rax
```

The first instruction loads the destination address into **RAX**. The second restores **RSP** from the value saved at **[RBP-8]**. Finally, **jmp rax** transfers control to that destination. The breakpoint is at the start of the sequence; the actual jump happens at **0x1002EAF80**.

If you're already thinking about automating the search, here are the bytes for this sequence:

```text
48 8B 45 E0 48 8B 65 F8 FF E0
```

> ![Byte pattern for the sequence before the OEP: 48 8B 45 E0 48 8B 65 F8 FF E0](/assets/images/enigma/eng22.png)

I also tested this pattern on other executables protected with Enigma x64 7.40 using the same settings. In those tests, it consistently led to the same point where the loader transfers control to the OEP. That makes it useful even when the unprotected file is unavailable: the pattern identifies the loader sequence, while the destination address comes from **RAX**. When using it on another file, follow the jump and check its destination.

After executing **jmp rax**, I landed at **0x1000162B0**, the OEP identified for the test application:

> ![Code at OEP 0x1000162B0, starting with a LEA instruction that adjusts RSP](/assets/images/enigma/eng23.png)

In this run, the image was loaded at base **0x100000000**. That puts the jump at RVA **0x2EAF80** and the OEP at RVA **0x162B0**. If this same image is loaded at a different base, recalculate the virtual addresses as **VA = image base + RVA**. [[13]](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)

## 5. Finding the IAT, creating the dump, and wrapping up

Alright, with the OEP located, there are three steps left:

1. Find the IAT in memory and work out its size.
2. Create the dump and rebuild the import structures.
3. Test the resulting executable and fix any problems in the PE.

### Following the thunks to the IAT

Shortly after the OEP, I found a call that x64dbg identifies as **GetModuleHandleA**. I stepped into it to see how the program reached the API:

> ![Call at 0x1000162F0 to the GetModuleHandleA thunk](/assets/images/enigma/eng24.png)

The immediate target was an **import thunk**: a small piece of code that jumps to the API through a pointer stored in the IAT. Nearby, there were other thunks for functions such as **WriteFile**, **ReadFile**, and **CloseHandle**:

> ![Thunks with indirect jumps to GetModuleHandleA, WriteFile, ReadFile, and CloseHandle](/assets/images/enigma/eng25.png)

Don't confuse the code with the pointer here. The **jmp qword ptr [...]** instruction is in the thunk; the memory address it references holds an IAT entry. I followed that address in the dump window and found the sequence of API pointers:

> ![IAT entries in memory, with API addresses and a null terminator between groups of imports](/assets/images/enigma/eng26.png)

Since this is an x64 executable, each entry takes up eight bytes, a **QWORD**. A null terminator marks the end of a DLL's import group; it doesn't necessarily mark the end of the entire IAT. [[13]](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format) In this sample, the groups were contiguous, and the range used for reconstruction was **0xD88** bytes long.

To calculate the size, I used the starting address and the first address past the table, including its final terminator:

```text
IAT start:             0x100290E3C
Exclusive end:         0x100291BC4
Size:                  0x100291BC4 - 0x100290E3C = 0xD88
```

These are the values I used in Scylla:

| Information | Value |
| --- | --- |
| OEP — virtual address | **0x1000162B0** |
| IAT start — virtual address | **0x100290E3C** |
| IAT size in bytes | **0xD88** |

With a base address of **0x100000000**, the corresponding RVAs are **0x162B0** for the OEP and **0x290E3C** for the IAT. The **OEP** and **VA** fields in the interface below take virtual addresses; the **Size** field takes the size in hexadecimal.

### Rebuilding the imports with Scylla

With those values, I used Scylla to read the imports and rebuild them in the dump. [[14]](https://github.com/NtQuery/Scylla) The steps in the interface are:

1. Select the right process, fill in **OEP**, **VA**, and **Size**, and use **Get Imports** to read the IAT.
2. Check the identified imports and use **Dump** to save the executable image.
3. Use **Fix Dump** and select the saved file to rebuild its import structures.

> ![Scylla x64 with OEP 0x1000162B0, IAT at 0x100290E3C, size 0xD88, and 425 valid imports; the log reports Import Rebuild success](/assets/images/enigma/eng27.png)

The screenshot shows 425 imports across eight DLLs, with no entries marked as invalid. The count also matches the range: 425 pointers plus eight null terminators make 433 entries of eight bytes each, or **0xD88**.

The log reported **Import Rebuild success**, but I still had to test the file outside the debugger. That's when the next problem showed up.

### Why the executable opened and then closed: the **.bss** section

After rebuilding the imports, the executable opened but closed about two seconds later. I spent quite a while trying to figure out why. I came up with all sorts of crazy theories, but the fix came down to how one section had been reconstructed: **.bss**.

The **.bss** section usually holds data with no explicit initialization, such as global variables that should start at zero. In the original file, it occupied space in memory but had no content stored on disk. Microsoft's PE specification describes this case: a section containing only uninitialized data has both **SizeOfRawData** and **PointerToRawData** set to zero, and its virtual space is filled with zeros when loaded. [[13]](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)

Comparing the original file with the dump after rebuilding the imports, I found these values:

| Field | Original **test64.exe** | Dump after Scylla, before the **.bss** fix |
| --- | --- | --- |
| Section RVA | **0x288000** | **0x288000** |
| **VirtualSize** | **0x6614** | **0x7000** |
| **SizeOfRawData** | **0** | **0x4A00** |
| **PointerToRawData** | **0** | **0x268A00** |

The dump I was examining at this point had been taken after the program had already run. The **.bss** section contained state from that run: I found nonzero bytes and values such as **0x100012AE0**. With **SizeOfRawData = 0x4A00**, the file supplied that content as the section's initial data. On the next launch, that region no longer started out entirely zeroed.

In PE-bear [[15]](https://github.com/hasherezade/pe-bear), I located the section by its RVA, **0x288000**, because its name was blank in the dump. I restored the **.bss** name and the original **VirtualSize**, and set the fields below:

```text
VirtualSize      = 0x6614
SizeOfRawData    = 0
PointerToRawData = 0
```

> ![PE-bear showing the .bss section at RVA 0x288000, with VirtualSize 0x6614 and both raw-data fields set to zero](/assets/images/enigma/eng28.png)

Restoring the name makes the section easier to identify; the size and on-disk data fields determine the behavior described here. With both raw-data fields set to zero, the captured bytes are no longer loaded as the section's initial content.

With the imports already rebuilt, I tested the executable again. This time, it stayed open after the change. I didn't trace the exact instruction that caused it to close; what I observed was that restoring these **.bss** fields fixed the behavior in this test.

This problem doesn't demonstrate an intentional anti-dump technique in Enigma. It was a reconstruction error: state from a previous run ended up in the file as though it were the initial state. Comparing it with the unprotected **test64.exe** helped me spot the difference.

### Wrapping up the test

At this point, I'd made it past the checks described here, reached the OEP, rebuilt the imports, and kept the recovered executable running outside the debugger. The part that took me the longest came after the dump. Finding the OEP and recovering the IAT were important steps, but checking the initial state of the PE sections was what let me finish this case.

## 6. An IDAPython script to go with it

I also put together an **IDAPython script** to automate part of this workflow on **Enigma Protector x64 7.40**. It handles the observed **NtSetInformationThread** and **CheckRemoteDebuggerPresent** calls, follows the loader's final-transfer sequence to the OEP, and saves a dump with the entry point adjusted. It also tries to identify the IAT range and prints the values for Scylla when the inference has high confidence. I still use Scylla to rebuild the imports.

The code is available in [IDA-UnpackEnigma-7.40](https://github.com/parapapinho/IDA-UnpackEnigma-7.40).

## References

**[1]** [ESET — Jakub Souček. Killing me gently: Inside Gentlemen’s EDR killer framework (June 18, 2026).](https://www.welivesecurity.com/en/eset-research/killing-me-gently-inside-gentlemens-edr-killer-framework/) Use of Enigma and Themida in the Gentlemen group's tools.

**[2]** [Aryaka Threat Research Lab. From Reconnaissance to Control: The Operational Blueprint of Kimsuky APT for Cyber Espionage — Report 2 (2025).](https://www.aryaka.com/docs/reports/aryaka-kimsuky-apt-operational-blueprint.pdf) Appendix B, page 30: Software Packing (Enigma Protector).

**[3]** [The Enigma Protector. Manual — Anti Debugger.](https://www.enigmaprotector.com/en/help/manual/programoverview-checkup-antidebugger) Options for initial checks, runtime checks, and the detection message.

**[4]** [The Enigma Protector. Manual — Import Protection.](https://www.enigmaprotector.com/en/help/manual/programoverview-protectionfeatures-importprotection) Import protection options, including WinAPI redirection and emulation.

**[5]** [Microsoft Learn. CheckRemoteDebuggerPresent.](https://learn.microsoft.com/en-us/windows/win32/api/debugapi/nf-debugapi-checkremotedebuggerpresent) API parameters, output BOOL, and return value.

**[6]** [Microsoft Learn. EXCEPTION_RECORD.](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-exception_record) Exception code, address, and types.

**[7]** [x64dbg. SetExceptionBPX.](https://help.x64dbg.com/en/latest/commands/breakpoint-control/SetExceptionBPX.html) First- and second-chance exception breakpoints.

**[8]** [x64dbg. SetExceptionBreakpointLog.](https://help.x64dbg.com/en/latest/commands/conditional-breakpoint-control/SetExceptionBreakpointLog.html) Configuring log messages for exception breakpoints.

**[9]** [x64dbg. exinfo.](https://help.x64dbg.com/en/latest/commands/analysis/exinfo.html) Inspecting the last exception received by the debugger.

**[10]** [System Informer / phnt. ntpsapi.h.](https://github.com/winsiderss/phnt/blob/master/ntpsapi.h) Native API definitions, including THREADINFOCLASS and ThreadHideFromDebugger.

**[11]** [Microsoft Learn. Windows Data Types.](https://learn.microsoft.com/en-us/windows/win32/winprog/windows-data-types) Definitions of BOOL, BOOLEAN, and other types used by the APIs.

**[12]** [Microsoft Learn. x64 calling convention.](https://learn.microsoft.com/en-us/cpp/build/x64-calling-convention?view=msvc-170) Argument passing and volatile registers, including RDX.

**[13]** [Microsoft Learn. PE Format.](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format) VA and RVA, import tables, and section header fields.

**[14]** [NtQuery. Scylla — Imports Reconstructor.](https://github.com/NtQuery/Scylla) Repository for the import reconstruction tool.

**[15]** [hasherezade. PE-bear.](https://github.com/hasherezade/pe-bear) Repository for the tool used to inspect and edit the PE.
