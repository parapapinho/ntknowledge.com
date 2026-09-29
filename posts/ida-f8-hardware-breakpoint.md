While debugging a Windows x64 challenge in IDA, I encountered a small function that checked for hardware breakpoints. It returned `true`, and the program printed a message saying that hardware breakpoints had been detected.

That did not match what I thought I had configured. I checked the breakpoint list: both entries were software breakpoints.

> ![Anti-debug function in IDA's pseudocode view](/assets/images/ida-f8/hbp4.png)
>
> *The breakpoints I had configured were all software breakpoints.*


At first, I suspected a bug in the detection routine. I later discovered that an IDA setting caused the debugger to create a temporary hardware breakpoint when I pressed F8.

## The check

The function's logic was essentially:

> ![Anti-debug function in IDA's pseudocode view](/assets/images/ida-f8/hbp3.png)
>
> *The function checks the debug-register values returned by GetThreadContext.*

```c
BOOL check_hw_breakpoints(void)
{
    CONTEXT ctx = {0};
    ctx.ContextFlags = CONTEXT_DEBUG_REGISTERS;

    if (!GetThreadContext(GetCurrentThread(), &ctx))
        return FALSE;

    return ctx.Dr0 != 0 || ctx.Dr1 != 0 ||
           ctx.Dr2 != 0 || ctx.Dr3 != 0;
}
```

There are two limitations worth identifying before interpreting the result.

First, a nonzero value in `Dr0–Dr3` only gives an address. Slot enablement is controlled by `DR7`: each slot `n` has a local enable bit `Ln` at position `2n` and a global enable bit `Gn` at position `2n + 1`. Either bit enables that slot. [Intel Software Developer's Manual, Volume 3B, Section 18.2.4](https://cdrdv2-public.intel.com/671427/253669-sdm-vol-3b.pdf#page=148)

The following expressions inspect the enable bits in a captured context, with `n` restricted to `0–3`:

```c
BOOL slot_enabled = (ctx.Dr7 & (0x3ULL << (2 * n))) != 0;
BOOL any_slot_enabled = (ctx.Dr7 & 0xFFULL) != 0;
```

The captured values showed a nonzero address in Dr0 and Dr7 = 0x501. The L0 bit was set, indicating that hardware-breakpoint slot 0 was enabled. The other set bits lie outside the enable mask. This also explains why testing `Dr7 != 0` alone is insufficient.

> ![DR7 enable bits and the 0x501 example](/assets/images/ida-f8/hbp8.png)
>
> *Masking the captured DR7 with 0xFF isolates the slot enable bits; the result identifies L0.*

Second, this function calls GetThreadContext on its own running thread. According to Microsoft, the call may report success even though the returned context is not valid. The code above reproduces the challenge's implementation, including this limitation. [GetThreadContext documentation](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getthreadcontext)

Those limitations made it especially useful to inspect the actual values behind the result.

## The address that explained it

I paused immediately after the call to `GetThreadContext` and inspected the local `Context` structure written by the API.

These were the values captured during that debugging session:

```text
RIP         = 0x7FF62A4210B6
Context.Dr0 = 0x7FF62A42216E
Context.Dr1 = 0x0000000000000000
Context.Dr2 = 0x0000000000000000
Context.Dr3 = 0x0000000000000000
Context.Dr7 = 0x0000000000000501
```

The context returned by `GetThreadContex`t showed a nonzero address in Dr0 and Dr7 = 0x501. The L0 bit was set, indicating that hardware-breakpoint slot 0 was enabled.

```text
0x501 & 0xFF = 0x01
```

This was more specific than finding a nonzero address in a disabled slot. The snapshot described an enabled breakpoint at exactly the address where the debugger needed to stop after stepping over the call.

> ![Anti-debug function in IDA's pseudocode view](/assets/images/ida-f8/hbp5.png)
>
> *Context.Dr0 points to the instruction after the call.*
>
> ![Anti-debug function in IDA's pseudocode view](/assets/images/ida-f8/hbp10.png)
>
>  *Context.Dr7 has L0 set.*

There was also an easy return-value trap here. At this point, `EAX = 1` was the return value of `GetThreadContext`: the API had reported success. It was not yet the anti-debug function's return value.

The function would subsequently inspect the captured fields and return `true` because `Context.Dr0` was nonzero. Those were two separate results.

## What F8 was doing

IDA has a debugger option named **Use hardware temporary breakpoints**.

When enabled, IDA attempts to use hardware breakpoints for temporary stops used by **Step Over** and **Run to**. It can fall back to software breakpoints if the hardware attempt fails. This behavior is explicitly described in the [Hex-Rays debugger options documentation](https://docs.hex-rays.com/9.0/user-guide/user-interface/menu-bar/debugger/debugger-options).

For the call I was stepping over, the sequence was:

1. I pressed F8 on the call to `GetThreadContext`.
2. IDA used a temporary hardware breakpoint at the following instruction.
3. The context returned during the call contained that breakpoint's address and enable bit.
4. Execution stopped at the temporary breakpoint.
5. The anti-debug code inspected the saved context and found the nonzero `Dr0`.

I had not manually configured that hardware breakpoint. It was part of the debugger's implementation of the step operation.

That explained why inspecting only my configured breakpoint list had been misleading.

> ![Anti-debug function in IDA's pseudocode view](/assets/images/ida-f8/hbp1.png)
>
> *This option allows IDA to use temporary hardware breakpoints when stepping over calls.*

## Changing one setting

I disabled **Use hardware temporary breakpoints**, repeated the execution, and the unexpected detection disappeared in the original challenge.

That comparison connected the result to the debugger option. The function was observing state introduced by the way I was stepping through it.

Repeating the call matters. Once `GetThreadContext` has copied values into a `CONTEXT` structure, that structure is a snapshot. Changing the debugger setting afterward does not rewrite the data already captured by the program.

> ![Anti-debug function in IDA's pseudocode view](/assets/images/ida-f8/hbp6.png)
>
> *Repeating the same operation with temporary hardware breakpoints disabled removed the observed trigger.*

## Reproducing the observation

I prepared a small C example, `ida_f8_hbp_demo.c`, that captures and prints the debug-register fields. It also reports the original address-only test separately from the `Dr7` enable mask.

The example deliberately retains the same current-thread query, including its documented limitation. It does not set or clear breakpoints itself.

The procedure is:

1. Run the EXE normally and save that observation as a baseline.
2. Open it in IDA, load its PDB, and select the local Windows debugger.
3. Set a software breakpoint at `capture_debug_registers`. Leave the hardware slots free for this experiment.
4. Enable **Use hardware temporary breakpoints**.
5. Stop on the `call` that invokes `GetThreadContext`, then press F8 on that specific instruction.
6. Compare the current instruction address with `g_context.Dr0–Dr3` and inspect `g_context.Dr7`.
7. Disable the option, restart, and repeat the same sequence.

Stepping over the outer call to `capture_debug_registers` would select a different return address, so the exact instruction matters.

What made this case memorable was that stepping through the check could introduce the very debugger state the program was looking for. A temporary breakpoint created by IDA could appear in the captured context even though I had configured only software breakpoints.

The source code for this example is available on GitHub: [ida_f8_hbp_demo.c](https://github.com/parapapinho/ntknowledge.com/blob/main/assets/ida_f8_hbp_demo.c).
