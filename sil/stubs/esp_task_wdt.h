/* Watchdog stub. The SIL harness never panics; it only records that the
 * firmware fed the dog, so a test can assert the feed happens each loop. */
#ifndef AQUAM_SIL_ESP_TASK_WDT_H
#define AQUAM_SIL_ESP_TASK_WDT_H
#include "arduino_stub_prelude.h"

#define ESP_OK 0
typedef int esp_err_t;

typedef struct {
  uint32_t timeout_ms;
  uint32_t idle_core_mask;
  bool     trigger_panic;
} esp_task_wdt_config_t;

namespace sil { extern uint32_t wdtFeeds; extern bool wdtStarted; }

inline esp_err_t esp_task_wdt_reconfigure(const esp_task_wdt_config_t *) { sil::wdtStarted = true; return ESP_OK; }
inline esp_err_t esp_task_wdt_init(const esp_task_wdt_config_t *)        { sil::wdtStarted = true; return ESP_OK; }
inline esp_err_t esp_task_wdt_init(uint32_t, bool)                       { sil::wdtStarted = true; return ESP_OK; }
inline esp_err_t esp_task_wdt_add(void *)                                { return ESP_OK; }
inline esp_err_t esp_task_wdt_reset()                                    { sil::wdtFeeds++; return ESP_OK; }

/*  The sketches guard on this macro to pick the core 2.x or 3.x watchdog API.
 *  The harness compiles the 3.x branch, matching the current toolchain. */
#ifndef ESP_ARDUINO_VERSION_MAJOR
#define ESP_ARDUINO_VERSION_MAJOR 3
#endif
#endif
