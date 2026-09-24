# Jobs

A job is a process plugin that the server starts as a child process on schedule or on button press: import, export, backup, rendering previews, reading documents, translation. Jobs never run inside the server process and talk to journali only via the interface.

## Creating

⏱ Jobs → + Job guides through four steps: which plugin, with which profile and parameters, where the storage is, when it runs. With a chosen profile only the parameters that hang on the job are shown; credentials and keys are kept as secrets on the server on the profile, never in the journal.

## Schedule

By hand only, hourly, daily, weekly, monthly or as an expression with minute, hour, day, month and weekday. A job can be switched off, then the schedule pauses; a running job can be paused, it waits at the next batch.

## Trays

Jobs that process files have trays on the server: In, Done, Failed, Out. A run takes what is in In and afterwards puts it into Done or Failed; outputs land in Out, optionally also as a medium in the library and as a copy under a fixed name. Retention says how many runs or how many days stay.

## Runs and logs

Every run is in the journal with start, end, result and size of the log; the log itself is a file on the server and can be read at the job. A job receives a service token per run with the role PIM editor, which expires with the run.

## What a job costs

The operational trace of a run, i.e. start, end, processed and written files, does not count against the quota. What a job writes as data counts like manual work: an import one entry per changed value, a repeated import without changes none.

## By itself

What the machine can do by itself, it does: previews are rendered by the job after every upload and after every preset change, without anyone going there. The button at the job is only the catch-up.
