package com.fintrack.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Answers the bare backend URL (bots, uptime checks) instead of logging a 401 for each visit. */
@RestController
public class RootController {

    @GetMapping("/")
    public String root() {
        return "FinTrack API";
    }
}
