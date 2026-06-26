# Token Slimmer Mode Evaluation

Generated: 2026-06-26T15:18:28.430Z
Files: 58
Sources: captures/

## Real Hermes Capture Summary

This summary is generated from local captured Hermes/OpenAI-compatible request JSON files. Synthetic samples are not used as real-world results in this section.

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools | Recommended use |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| safe | 1,550,698 | 1,542,375 | 8,323 | 0.5% | 7,458 | 925 | 0 | 0 | Low-risk baseline; smallest savings |
| balanced | 1,550,698 | 1,197,640 | 353,058 | 22.8% | 7,458 | 335,364 | 0 | 0 | Recommended normal agent mode; no tools stripping |
| aggressive | 1,550,698 | 1,002,979 | 547,719 | 35.3% | 215,952 | 322,182 | 0 | 0 | Higher savings, lossy; test agent behavior |
| aggressive+STRIP_TOOLS | 1,550,698 | 712,629 | 838,069 | 54.0% | 215,952 | 322,182 | 0 | 290,350 | Experimental; may affect tool calling |

## Aggregate Token X-Ray

### Before Compression

| Mode | Tools Schema | System | User | Assistant | Tool | Function | Other |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 506,253 | 201,899 | 12,287 | 154,122 | 675,183 | 0 | 0 |
| balanced | 506,253 | 201,899 | 12,287 | 154,122 | 675,183 | 0 | 0 |
| aggressive | 506,253 | 201,899 | 12,287 | 154,122 | 675,183 | 0 | 0 |
| aggressive+STRIP_TOOLS | 506,253 | 201,899 | 12,287 | 154,122 | 675,183 | 0 | 0 |

### After Compression

| Mode | Tools Schema | System | User | Assistant | Tool | Function | Other |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 498,795 | 201,899 | 12,287 | 154,122 | 674,299 | 0 | 0 |
| balanced | 498,795 | 201,899 | 12,287 | 154,122 | 329,610 | 0 | 0 |
| aggressive | 290,301 | 201,899 | 12,287 | 154,122 | 343,424 | 0 | 0 |
| aggressive+STRIP_TOOLS | 0 | 201,899 | 12,287 | 154,122 | 343,424 | 0 | 0 |

### Saved By Category

| Mode | Tools Schema | System | User | Assistant | Tool | Function | Other |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 7,458 | 0 | 0 | 0 | 884 | 0 | 0 |
| balanced | 7,458 | 0 | 0 | 0 | 345,573 | 0 | 0 |
| aggressive | 215,952 | 0 | 0 | 0 | 331,759 | 0 | 0 |
| aggressive+STRIP_TOOLS | 506,253 | 0 | 0 | 0 | 331,759 | 0 | 0 |


## File Details

### captures\2026-06-26T11-27-54-422Z-GET-v1-models-no83xm.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-28-22-189Z-GET-v1-props-didwlv.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-28-25-315Z-GET-v1-models-5wga4g.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-28-32-321Z-GET-v1-props-urc4qo.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-28-35-900Z-GET-v1-models-deepseek-ai-deepseek-v4-flash-945mtd.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-28-35-932Z-GET-v1-models-9mqu7y.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-28-39-434Z-GET-v1-props-pexeih.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-28-44-288Z-POST-v1-chat-completions-rhk43t.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 21,565 | 21,339 | 226 | 1.0% | 226 | 0 | 0 | 0 |
| balanced | 21,565 | 21,339 | 226 | 1.0% | 226 | 0 | 0 | 0 |
| aggressive | 21,565 | 15,021 | 6,544 | 30.3% | 6,544 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 21,565 | 6,222 | 15,343 | 71.1% | 6,544 | 0 | 0 | 8,799 |

### captures\2026-06-26T11-28-51-089Z-POST-v1-chat-completions-1w807v.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 21,721 | 21,494 | 227 | 1.0% | 226 | 1 | 0 | 0 |
| balanced | 21,721 | 21,494 | 227 | 1.0% | 226 | 1 | 0 | 0 |
| aggressive | 21,721 | 15,176 | 6,545 | 30.1% | 6,544 | 1 | 0 | 0 |
| aggressive+STRIP_TOOLS | 21,721 | 6,378 | 15,343 | 70.6% | 6,544 | 1 | 0 | 8,798 |

### captures\2026-06-26T11-28-57-950Z-POST-v1-chat-completions-fd88zx.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 21,898 | 21,670 | 228 | 1.0% | 226 | 3 | 0 | 0 |
| balanced | 21,898 | 21,670 | 228 | 1.0% | 226 | 3 | 0 | 0 |
| aggressive | 21,898 | 15,352 | 6,546 | 29.9% | 6,544 | 3 | 0 | 0 |
| aggressive+STRIP_TOOLS | 21,898 | 6,554 | 15,344 | 70.1% | 6,544 | 3 | 0 | 8,798 |

### captures\2026-06-26T11-29-04-733Z-POST-v1-chat-completions-0ly9ys.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 22,047 | 21,818 | 229 | 1.0% | 226 | 5 | 0 | 0 |
| balanced | 22,047 | 21,818 | 229 | 1.0% | 226 | 5 | 0 | 0 |
| aggressive | 22,047 | 15,500 | 6,547 | 29.7% | 6,544 | 5 | 0 | 0 |
| aggressive+STRIP_TOOLS | 22,047 | 6,701 | 15,346 | 69.6% | 6,544 | 5 | 0 | 8,799 |

### captures\2026-06-26T11-29-11-563Z-POST-v1-chat-completions-vxayof.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 22,325 | 22,096 | 229 | 1.0% | 226 | 5 | 0 | 0 |
| balanced | 22,325 | 22,096 | 229 | 1.0% | 226 | 5 | 0 | 0 |
| aggressive | 22,325 | 15,777 | 6,548 | 29.3% | 6,544 | 5 | 0 | 0 |
| aggressive+STRIP_TOOLS | 22,325 | 6,979 | 15,346 | 68.7% | 6,544 | 5 | 0 | 8,798 |

### captures\2026-06-26T11-29-19-184Z-POST-v1-chat-completions-h13ppp.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 22,606 | 22,377 | 229 | 1.0% | 226 | 5 | 0 | 0 |
| balanced | 22,606 | 22,377 | 229 | 1.0% | 226 | 5 | 0 | 0 |
| aggressive | 22,606 | 16,058 | 6,548 | 29.0% | 6,544 | 5 | 0 | 0 |
| aggressive+STRIP_TOOLS | 22,606 | 7,260 | 15,346 | 67.9% | 6,544 | 5 | 0 | 8,798 |

### captures\2026-06-26T11-29-26-659Z-POST-v1-chat-completions-yea142.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 22,800 | 22,570 | 230 | 1.0% | 226 | 6 | 0 | 0 |
| balanced | 22,800 | 22,570 | 230 | 1.0% | 226 | 6 | 0 | 0 |
| aggressive | 22,800 | 16,252 | 6,548 | 28.7% | 6,544 | 6 | 0 | 0 |
| aggressive+STRIP_TOOLS | 22,800 | 7,454 | 15,346 | 67.3% | 6,544 | 6 | 0 | 8,798 |

### captures\2026-06-26T11-29-34-410Z-POST-v1-chat-completions-k98g5z.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 23,025 | 22,794 | 231 | 1.0% | 226 | 7 | 0 | 0 |
| balanced | 23,025 | 22,794 | 231 | 1.0% | 226 | 7 | 0 | 0 |
| aggressive | 23,025 | 16,476 | 6,549 | 28.4% | 6,544 | 7 | 0 | 0 |
| aggressive+STRIP_TOOLS | 23,025 | 7,677 | 15,348 | 66.7% | 6,544 | 7 | 0 | 8,799 |

### captures\2026-06-26T11-29-41-903Z-POST-v1-chat-completions-stq67f.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 23,174 | 22,942 | 232 | 1.0% | 226 | 9 | 0 | 0 |
| balanced | 23,174 | 22,942 | 232 | 1.0% | 226 | 9 | 0 | 0 |
| aggressive | 23,174 | 16,624 | 6,550 | 28.3% | 6,544 | 9 | 0 | 0 |
| aggressive+STRIP_TOOLS | 23,174 | 7,825 | 15,349 | 66.2% | 6,544 | 9 | 0 | 8,799 |

### captures\2026-06-26T11-29-50-057Z-POST-v1-chat-completions-hlvgs0.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 23,780 | 23,547 | 233 | 1.0% | 226 | 10 | 0 | 0 |
| balanced | 23,780 | 23,547 | 233 | 1.0% | 226 | 10 | 0 | 0 |
| aggressive | 23,780 | 17,228 | 6,552 | 27.6% | 6,544 | 10 | 0 | 0 |
| aggressive+STRIP_TOOLS | 23,780 | 8,430 | 15,350 | 64.6% | 6,544 | 10 | 0 | 8,798 |

### captures\2026-06-26T11-29-56-922Z-POST-v1-chat-completions-ltf3aw.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 23,998 | 23,763 | 235 | 1.0% | 226 | 11 | 0 | 0 |
| balanced | 23,998 | 23,763 | 235 | 1.0% | 226 | 11 | 0 | 0 |
| aggressive | 23,998 | 17,445 | 6,553 | 27.3% | 6,544 | 11 | 0 | 0 |
| aggressive+STRIP_TOOLS | 23,998 | 8,646 | 15,352 | 64.0% | 6,544 | 11 | 0 | 8,799 |

### captures\2026-06-26T11-30-36-699Z-POST-v1-chat-completions-22l27d.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 24,215 | 23,979 | 236 | 1.0% | 226 | 13 | 0 | 0 |
| balanced | 24,215 | 23,979 | 236 | 1.0% | 226 | 13 | 0 | 0 |
| aggressive | 24,215 | 17,661 | 6,554 | 27.1% | 6,544 | 13 | 0 | 0 |
| aggressive+STRIP_TOOLS | 24,215 | 8,862 | 15,353 | 63.4% | 6,544 | 13 | 0 | 8,799 |

### captures\2026-06-26T11-30-43-285Z-POST-v1-chat-completions-6puu2o.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 25,549 | 25,311 | 238 | 0.9% | 226 | 14 | 0 | 0 |
| balanced | 25,549 | 25,311 | 238 | 0.9% | 226 | 14 | 0 | 0 |
| aggressive | 25,549 | 18,993 | 6,556 | 25.7% | 6,544 | 14 | 0 | 0 |
| aggressive+STRIP_TOOLS | 25,549 | 10,195 | 15,354 | 60.1% | 6,544 | 14 | 0 | 8,798 |

### captures\2026-06-26T11-30-52-708Z-POST-v1-chat-completions-jq5szx.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 29,808 | 29,569 | 239 | 0.8% | 226 | 15 | 0 | 0 |
| balanced | 29,808 | 27,514 | 2,294 | 7.7% | 226 | 2,042 | 0 | 0 |
| aggressive | 29,808 | 21,232 | 8,576 | 28.8% | 6,544 | 2,006 | 0 | 0 |
| aggressive+STRIP_TOOLS | 29,808 | 12,434 | 17,374 | 58.3% | 6,544 | 2,006 | 0 | 8,798 |

### captures\2026-06-26T11-31-02-799Z-POST-v1-chat-completions-if7ggc.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 30,415 | 30,170 | 245 | 0.8% | 226 | 21 | 0 | 0 |
| balanced | 30,415 | 28,115 | 2,300 | 7.6% | 226 | 2,048 | 0 | 0 |
| aggressive | 30,415 | 21,834 | 8,581 | 28.2% | 6,544 | 2,012 | 0 | 0 |
| aggressive+STRIP_TOOLS | 30,415 | 13,035 | 17,380 | 57.1% | 6,544 | 2,012 | 0 | 8,799 |

### captures\2026-06-26T11-31-14-878Z-POST-v1-chat-completions-s7jfss.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 39,570 | 39,321 | 249 | 0.6% | 226 | 25 | 0 | 0 |
| balanced | 39,570 | 31,185 | 8,385 | 21.2% | 226 | 7,936 | 0 | 0 |
| aggressive | 39,570 | 24,535 | 15,035 | 38.0% | 6,544 | 8,267 | 0 | 0 |
| aggressive+STRIP_TOOLS | 39,570 | 15,737 | 23,833 | 60.2% | 6,544 | 8,267 | 0 | 8,798 |

### captures\2026-06-26T11-31-33-009Z-POST-v1-chat-completions-iii90b.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 53,950 | 53,694 | 256 | 0.5% | 226 | 31 | 0 | 0 |
| balanced | 53,950 | 37,164 | 16,786 | 31.1% | 226 | 16,052 | 0 | 0 |
| aggressive | 53,950 | 31,261 | 22,689 | 42.1% | 6,544 | 15,672 | 0 | 0 |
| aggressive+STRIP_TOOLS | 53,950 | 22,462 | 31,488 | 58.4% | 6,544 | 15,672 | 0 | 8,799 |

### captures\2026-06-26T11-31-42-532Z-POST-v1-chat-completions-gyhmt6.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 54,253 | 53,996 | 257 | 0.5% | 226 | 32 | 0 | 0 |
| balanced | 54,253 | 37,466 | 16,787 | 30.9% | 226 | 16,053 | 0 | 0 |
| aggressive | 54,253 | 31,561 | 22,692 | 41.8% | 6,544 | 15,674 | 0 | 0 |
| aggressive+STRIP_TOOLS | 54,253 | 22,763 | 31,490 | 58.0% | 6,544 | 15,674 | 0 | 8,798 |

### captures\2026-06-26T11-32-21-341Z-POST-v1-chat-completions-v9f4hk.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 367 | 367 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 367 | 367 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 367 | 367 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 367 | 367 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-32-25-108Z-GET-v1-props-2xm1wz.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-32-28-703Z-GET-v1-models-deepseek-ai-deepseek-v4-flash-1td7pc.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-32-28-730Z-GET-v1-models-4j8i1t.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-32-32-258Z-GET-v1-props-kdydzn.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-32-34-818Z-POST-v1-chat-completions-ulnqlx.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 58,473 | 58,215 | 258 | 0.4% | 226 | 32 | 0 | 0 |
| balanced | 58,473 | 41,686 | 16,787 | 28.7% | 226 | 16,053 | 0 | 0 |
| aggressive | 58,473 | 35,781 | 22,692 | 38.8% | 6,544 | 15,674 | 0 | 0 |
| aggressive+STRIP_TOOLS | 58,473 | 26,982 | 31,491 | 53.9% | 6,544 | 15,674 | 0 | 8,799 |

### captures\2026-06-26T11-32-35-857Z-POST-v1-chat-completions-8l4j5d.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 57,043 | 56,786 | 257 | 0.5% | 226 | 32 | 0 | 0 |
| balanced | 57,043 | 40,256 | 16,787 | 29.4% | 226 | 16,053 | 0 | 0 |
| aggressive | 57,043 | 34,351 | 22,692 | 39.8% | 6,544 | 15,674 | 0 | 0 |
| aggressive+STRIP_TOOLS | 57,043 | 25,553 | 31,490 | 55.2% | 6,544 | 15,674 | 0 | 8,798 |

### captures\2026-06-26T11-32-55-302Z-POST-v1-chat-completions-xk53s6.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 72,104 | 71,829 | 275 | 0.4% | 226 | 50 | 0 | 0 |
| balanced | 72,104 | 45,388 | 26,716 | 37.1% | 226 | 25,668 | 0 | 0 |
| aggressive | 72,104 | 39,341 | 32,763 | 45.4% | 6,544 | 25,418 | 0 | 0 |
| aggressive+STRIP_TOOLS | 72,104 | 30,542 | 41,562 | 57.6% | 6,544 | 25,418 | 0 | 8,799 |

### captures\2026-06-26T11-33-04-462Z-POST-v1-chat-completions-wh23vy.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 61,584 | 61,317 | 267 | 0.4% | 226 | 42 | 0 | 0 |
| balanced | 61,584 | 44,787 | 16,797 | 27.3% | 226 | 16,063 | 0 | 0 |
| aggressive | 61,584 | 38,882 | 22,702 | 36.9% | 6,544 | 15,684 | 0 | 0 |
| aggressive+STRIP_TOOLS | 61,584 | 30,084 | 31,500 | 51.1% | 6,544 | 15,684 | 0 | 8,798 |

### captures\2026-06-26T11-33-31-875Z-GET-v1-props-mtiu6d.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-33-33-952Z-GET-v1-models-y9lr4y.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-33-36-675Z-POST-v1-chat-completions-nrvrnu.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 76,278 | 76,001 | 277 | 0.4% | 226 | 52 | 0 | 0 |
| balanced | 76,278 | 49,560 | 26,718 | 35.0% | 226 | 25,670 | 0 | 0 |
| aggressive | 76,278 | 43,513 | 32,765 | 43.0% | 6,544 | 25,420 | 0 | 0 |
| aggressive+STRIP_TOOLS | 76,278 | 34,714 | 41,564 | 54.5% | 6,544 | 25,420 | 0 | 8,799 |

### captures\2026-06-26T11-33-50-384Z-POST-v1-chat-completions-lxx2sv.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 76,700 | 76,422 | 278 | 0.4% | 226 | 53 | 0 | 0 |
| balanced | 76,700 | 49,981 | 26,719 | 34.8% | 226 | 25,671 | 0 | 0 |
| aggressive | 76,700 | 43,934 | 32,766 | 42.7% | 6,544 | 25,421 | 0 | 0 |
| aggressive+STRIP_TOOLS | 76,700 | 35,136 | 41,564 | 54.2% | 6,544 | 25,421 | 0 | 8,798 |

### captures\2026-06-26T11-34-27-464Z-POST-v1-chat-completions-jq2321.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 65,596 | 65,329 | 267 | 0.4% | 226 | 42 | 0 | 0 |
| balanced | 65,596 | 48,799 | 16,797 | 25.6% | 226 | 16,063 | 0 | 0 |
| aggressive | 65,596 | 42,894 | 22,702 | 34.6% | 6,544 | 15,684 | 0 | 0 |
| aggressive+STRIP_TOOLS | 65,596 | 34,096 | 31,500 | 48.0% | 6,544 | 15,684 | 0 | 8,798 |

### captures\2026-06-26T11-34-38-002Z-POST-v1-chat-completions-jdgclw.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 65,659 | 65,391 | 268 | 0.4% | 226 | 42 | 0 | 0 |
| balanced | 65,659 | 48,862 | 16,797 | 25.6% | 226 | 16,063 | 0 | 0 |
| aggressive | 65,659 | 42,957 | 22,702 | 34.6% | 6,544 | 15,684 | 0 | 0 |
| aggressive+STRIP_TOOLS | 65,659 | 34,158 | 31,501 | 48.0% | 6,544 | 15,684 | 0 | 8,799 |

### captures\2026-06-26T11-34-50-294Z-POST-v1-chat-completions-rnmow4.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 65,934 | 65,665 | 269 | 0.4% | 226 | 44 | 0 | 0 |
| balanced | 65,934 | 49,136 | 16,798 | 25.5% | 226 | 16,065 | 0 | 0 |
| aggressive | 65,934 | 43,231 | 22,703 | 34.4% | 6,544 | 15,686 | 0 | 0 |
| aggressive+STRIP_TOOLS | 65,934 | 34,432 | 31,502 | 47.8% | 6,544 | 15,686 | 0 | 8,799 |

### captures\2026-06-26T11-35-06-902Z-POST-v1-chat-completions-kcwqnr.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 17 | 17 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 17 | 17 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 17 | 17 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 17 | 17 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-35-07-156Z-POST-v1-chat-completions-qh2q90.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 17 | 17 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 17 | 17 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 17 | 17 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 17 | 17 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-35-07-206Z-POST-v1-chat-completions-rnzz9f.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 17 | 17 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 17 | 17 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 17 | 17 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 17 | 17 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-35-07-247Z-POST-v1-chat-completions-dhxpxr.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 21 | 21 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 21 | 21 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 21 | 21 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 21 | 21 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-35-07-309Z-POST-v1-chat-completions-wib5kl.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 17 | 17 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 17 | 17 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 17 | 17 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 17 | 17 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-35-07-355Z-POST-v1-embeddings-vrgp3p.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 8 | 8 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 8 | 8 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 8 | 8 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 8 | 8 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-35-07-399Z-POST-v1-chat-completions-pef3rs.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 21 | 21 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 21 | 21 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 21 | 21 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 21 | 21 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-35-10-066Z-POST-v1-chat-completions-7r9gwh.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 68,101 | 67,831 | 270 | 0.4% | 226 | 46 | 0 | 0 |
| balanced | 68,101 | 50,164 | 17,937 | 26.3% | 226 | 17,170 | 0 | 0 |
| aggressive | 68,101 | 44,547 | 23,554 | 34.6% | 6,544 | 16,510 | 0 | 0 |
| aggressive+STRIP_TOOLS | 68,101 | 35,749 | 32,352 | 47.5% | 6,544 | 16,510 | 0 | 8,798 |

### captures\2026-06-26T11-35-24-870Z-POST-v1-chat-completions-viwexj.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 69,231 | 68,957 | 274 | 0.4% | 226 | 52 | 0 | 0 |
| balanced | 69,231 | 51,290 | 17,941 | 25.9% | 226 | 17,176 | 0 | 0 |
| aggressive | 69,231 | 45,674 | 23,557 | 34.0% | 6,544 | 16,516 | 0 | 0 |
| aggressive+STRIP_TOOLS | 69,231 | 36,875 | 32,356 | 46.7% | 6,544 | 16,516 | 0 | 8,799 |

### captures\2026-06-26T11-35-37-787Z-POST-v1-chat-completions-xt62lm.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 70,451 | 70,175 | 276 | 0.4% | 226 | 54 | 0 | 0 |
| balanced | 70,451 | 52,508 | 17,943 | 25.5% | 226 | 17,178 | 0 | 0 |
| aggressive | 70,451 | 46,891 | 23,560 | 33.4% | 6,544 | 16,518 | 0 | 0 |
| aggressive+STRIP_TOOLS | 70,451 | 38,093 | 32,358 | 45.9% | 6,544 | 16,518 | 0 | 8,798 |

### captures\2026-06-26T11-35-51-221Z-POST-v1-chat-completions-vxeaan.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 74,683 | 74,405 | 278 | 0.4% | 226 | 55 | 0 | 0 |
| balanced | 74,683 | 53,802 | 20,881 | 28.0% | 226 | 20,087 | 0 | 0 |
| aggressive | 74,683 | 49,795 | 24,888 | 33.3% | 6,544 | 17,833 | 0 | 0 |
| aggressive+STRIP_TOOLS | 74,683 | 40,996 | 33,687 | 45.1% | 6,544 | 17,833 | 0 | 8,799 |

### captures\2026-06-26T11-36-03-774Z-POST-v1-chat-completions-e9sp4g.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 79,285 | 79,005 | 280 | 0.4% | 226 | 58 | 0 | 0 |
| balanced | 79,285 | 55,342 | 23,943 | 30.2% | 226 | 23,082 | 0 | 0 |
| aggressive | 79,285 | 51,805 | 27,480 | 34.7% | 6,544 | 20,370 | 0 | 0 |
| aggressive+STRIP_TOOLS | 79,285 | 43,006 | 36,279 | 45.8% | 6,544 | 20,370 | 0 | 8,799 |

### captures\2026-06-26T11-36-35-480Z-GET-v1-props-h74p74.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-36-39-029Z-GET-v1-models-deepseek-ai-deepseek-v4-flash-imynhi.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-36-39-058Z-GET-v1-models-4vtgdc.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-36-42-559Z-GET-v1-props-ebbgt4.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| balanced | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| aggressive+STRIP_TOOLS | 1 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 |

### captures\2026-06-26T11-36-45-096Z-POST-v1-chat-completions-fj40p9.json

| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| safe | 82,375 | 82,095 | 280 | 0.3% | 226 | 58 | 0 | 0 |
| balanced | 82,375 | 58,433 | 23,942 | 29.1% | 226 | 23,082 | 0 | 0 |
| aggressive | 82,375 | 54,895 | 27,480 | 33.4% | 6,544 | 20,370 | 0 | 0 |
| aggressive+STRIP_TOOLS | 82,375 | 46,097 | 36,278 | 44.0% | 6,544 | 20,370 | 0 | 8,798 |

