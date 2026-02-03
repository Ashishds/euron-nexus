# 🚀 Simple Deployment Guide (Beginner Friendly)

Follow these 4 simple steps to put your website online!

---

## Step 1: Get Your AWS Access Keys
You need a "username" and "password" for the script to talk to AWS.

1.  Log in to your **AWS Console**: [https://console.aws.amazon.com/](https://console.aws.amazon.com/)
2.  Click on your name in the top right corner.
3.  Select **"Security Credentials"**.
4.  Scroll down to the **"Access keys"** section.
5.  Click **"Create access key"**.
6.  Select **"Command Line Interface (CLI)"**.
7.  Click **Next** and then **Create access key**.
8.  **IMPORTANT:** Click **"Download .csv file"** or copy the **Access Key** and **Secret Access Key** immediately. You verify won't see the Secret Key again!

---

## Step 2: Configure Your Computer
Tell your computer who you are.

1.  Open your Terminal (Command Prompt or PowerShell).
2.  Type this command and press Enter:
    ```cmd
    aws configure
    ```
3.  It will ask you 4 questions. Fill them in like this:

    *   **AWS Access Key ID**: (Paste the Access Key you just got)
    *   **AWS Secret Access Key**: (Paste the Secret Key you just got)
    *   **Default region name**: `ap-south-1`
    *   **Default output format**: `json`

---

## Step 3: Run the "Magic" Script
This script does everything for you (creates server, uploads code, starts website).

1.  In your terminal, make sure you are in the project folder:
    ```cmd
    cd f:\euron-intervie-ai-agent
    ```
2.  Run the deployment script:
    ```cmd
    .\deploy-infra.bat
    ```
3.  **Wait.** It will take about 3-5 minutes.
    *   It will ask you to confirm. Type `yes` when asked.
4.  At the end, it will show you something like:
    ```
    website_url = "http://13.235.xx.xx"
    ```
    **COPY THIS NUMBER (IP Address).**

---

## Step 4: Connect Your Domain
Now point `www.mydatainterview.in` to that IP address.

1.  Go to where you bought your domain (GoDaddy, Namecheap, etc.).
2.  Find **DNS Settings** or **DNS Management**.
3.  Look for **A Records**.
4.  Edit (or Add) these two records:

    | Type | Name | Value (IP Address) |
    | :--- | :--- | :--- |
    | **A** | `@` | The IP you copied (e.g., 13.235.xx.xx) |
    | **A** | `www` | The IP you copied (e.g., 13.235.xx.xx) |

---

## 🎉 YOU ARE DONE!
Wait about 10-30 minutes for the settings to spread across the internet.
Then verify `http://www.mydatainterview.in` in your browser.

### 🔒 Final Touch (Enable HTTPS)
Once your site works on the web:

1.  Look at the "ssh_command" output from Step 3. It looks like:
    `ssh -i euron-key.pem ubuntu@13.235.xx.xx`.
2.  Run that command in your terminal to log in to your server.
3.  Type:
    ```bash
    sudo ./get-ssl.sh
    ```
4.  Enter your email when asked. This gives you the green padlock 🔒!
