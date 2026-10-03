import os
import sys
import json
import time
import urllib.request
import urllib.error

RENDER_API_KEY = "rnd_NdgROUFWjOndSsadCcAC9nDiDED2"
OWNER_ID = "tea-davas83bc2fs73c5mqp0"
REPO_URL = "https://github.com/Athxl-rreji/MEDORA"
SERVICE_NAME = "medora-backend"

ENV_VARS = [
    {"key": "PYTHON_VERSION", "value": "3.11.9"},
    {"key": "PORT", "value": "8000"},
    {"key": "ENVIRONMENT", "value": "production"},
    {"key": "ALLOWED_ORIGINS", "value": "*"},
    {"key": "SUPABASE_URL", "value": "https://pahrhwcigcrdwvpxyxop.supabase.co"},
    {"key": "SUPABASE_KEY", "value": "sb_publishable_uoqbLCd0JokQJGizvo6PcA_4xj9rAQt"},
    {"key": "SUPABASE_SERVICE_ROLE_KEY", "value": "sb_publishable_uoqbLCd0JokQJGizvo6PcA_4xj9rAQt"},
    {"key": "GEMINI_API_KEY", "value": "AQ.Ab8RN6Js_Iap5zHDJQp1PFrwsCfP8gWoEogju4w41SRKg02_TQ"},
    {"key": "OPENAI_API_KEY", "value": "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"},
    {"key": "OPENROUTER_API_KEY", "value": "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"},
    {"key": "OPENROUTER_MODEL", "value": "openrouter/free"},
    {"key": "RAZORPAY_KEY_ID", "value": "rzp_test_TGSG2Ef0As1aMa"},
    {"key": "RAZORPAY_KEY_SECRET", "value": "X44IAL2HuzatQ8PmZKli9ZpX"},
    {"key": "SMTP_SERVER", "value": "smtp.gmail.com"},
    {"key": "SMTP_PORT", "value": "587"},
    {"key": "SMTP_USER", "value": "medora2k26@gmail.com"},
    {"key": "GMAIL_APP_PASSWORD", "value": "qpgy dkwk nfvx ytfi"}
]

def render_request(endpoint, method="GET", payload=None):
    url = f"https://api.render.com/v1{endpoint}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {
        "Authorization": f"Bearer {RENDER_API_KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_msg)
        except Exception:
            return e.code, {"message": err_msg}

def main():
    print("=" * 60)
    print("  MEDORA Automated Render Backend Provisioner & Deployer")
    print("=" * 60)

    # 1. Check existing services
    print("\n[1/4] Querying existing services in Render workspace...")
    code, services = render_request("/services")
    if code != 200:
        print(f"Error listing services: {code} - {services}")
        sys.exit(1)

    target_service = None
    for item in services:
        svc = item.get("service", item)
        if svc.get("name") == SERVICE_NAME:
            target_service = svc
            break

    if target_service:
        service_id = target_service["id"]
        service_url = target_service.get("serviceDetails", {}).get("url") or f"https://{SERVICE_NAME}.onrender.com"
        print(f"[FOUND] Existing Render service: {SERVICE_NAME} (ID: {service_id})")
        print(f"        Live URL: {service_url}")

        # Trigger manual deploy
        print("\n[2/4] Triggering latest build deploy on Render...")
        d_code, d_resp = render_request(f"/services/{service_id}/deploys", method="POST", payload={"clearCache": "clear"})
        print(f"Deploy response: {d_code} - {d_resp.get('id', 'Deploy triggered')}")
    else:
        print(f"[+] Creating new Web Service '{SERVICE_NAME}' on Render...")
        create_payload = {
            "type": "web_service",
            "name": SERVICE_NAME,
            "ownerId": OWNER_ID,
            "repo": REPO_URL,
            "branch": "main",
            "autoDeploy": "yes",
            "serviceDetails": {
                "env": "python",
                "plan": "free",
                "region": "singapore",
                "rootDir": "backend",
                "envSpecificDetails": {
                    "buildCommand": "pip install -r requirements.txt",
                    "startCommand": "uvicorn main:app --host 0.0.0.0 --port $PORT"
                },
                "healthCheckPath": "/health",
                "envVars": ENV_VARS
            }
        }
        c_code, c_resp = render_request("/services", method="POST", payload=create_payload)
        if c_code not in (200, 201):
            print(f"[ERROR] Failed to create Render service: {c_code}")
            print(json.dumps(c_resp, indent=2))
            sys.exit(1)

        target_service = c_resp.get("service", c_resp)
        service_id = target_service["id"]
        service_url = target_service.get("serviceDetails", {}).get("url") or f"https://{SERVICE_NAME}.onrender.com"
        print(f"[SUCCESS] Service created! ID: {service_id}")
        print(f"          Live URL: {service_url}")

    # Ensure URL is clean and without trailing slash
    service_url = service_url.rstrip("/")
    with open(".render_url", "w") as f:
        f.write(service_url)

    print(f"\n[3/4] Render backend URL registered: {service_url}")
    print("\n[4/4] Monitoring deployment status...")
    for attempt in range(1, 25):
        time.sleep(6)
        d_code, deploys = render_request(f"/services/{service_id}/deploys?limit=1")
        if d_code == 200 and deploys:
            dep = deploys[0].get("deploy", deploys[0])
            status = dep.get("status", "unknown")
            print(f"  Attempt {attempt}/25 -> Deploy Status: {status}")
            if status == "live":
                print(f"\n🎉 Render Backend is LIVE and healthy at: {service_url}")
                break
            elif status in ("build_failed", "update_failed", "canceled"):
                print(f"\n⚠️ Deploy finished with status: {status}")
                break
        else:
            print(f"  Attempt {attempt}/25 -> Checking...")

    print("\nRender setup completed.")
    print(f"Target Backend Endpoint: {service_url}")
    return service_url

if __name__ == "__main__":
    main()
