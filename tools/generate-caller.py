#!/usr/bin/env python3
"""Render Lotería MP3s with Jorge on an existing Azure Speech F0 resource."""

import argparse
import json
from pathlib import Path
import re
import subprocess
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
VOICE = "es-MX-JorgeNeural"
PREVIEW = {"start", "El Gallo", "La Sandía", "El Violoncello"}
AZURE_ACCOUNT = ("az", "cognitiveservices", "account")


def azure_output(*args):
    try:
        return subprocess.check_output(
            [*AZURE_ACCOUNT, *args, "--only-show-errors"], text=True
        ).strip()
    except FileNotFoundError:
        raise SystemExit("Install the Azure CLI and sign in to an existing Speech F0 resource.") from None
    except subprocess.CalledProcessError:
        raise SystemExit("Azure CLI could not access the requested Speech resource.") from None


def get_resource(resource_group, name):
    resource = ("--resource-group", resource_group, "--name", name)
    info = json.loads(azure_output("show", *resource, "--output", "json"))
    if info.get("kind") != "SpeechServices" or (info.get("sku") or {}).get("name") != "F0":
        raise SystemExit("Generation requires an Azure Speech resource on the free F0 tier.")
    region = info.get("location", "")
    if not re.fullmatch(r"[a-z0-9]+", region):
        raise SystemExit("Azure returned an invalid Speech resource region.")
    key = azure_output("keys", "list", *resource, "--query", "key1", "--output", "tsv")
    if not key:
        raise SystemExit("Azure did not return a Speech resource key.")
    return f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1", key


def synthesize(endpoint, key, phrase):
    ssml = (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        'xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="es-MX">'
        f'<voice name="{VOICE}"><mstts:express-as style="cheerful">'
        f'{escape(phrase)}</mstts:express-as></voice></speak>'
    )
    request = Request(endpoint, data=ssml.encode("utf-8"), headers={
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "LoteriaCallerGenerator",
    })
    try:
        with urlopen(request, timeout=30) as response:
            audio = response.read()
            has_mp3_header = audio.startswith(b"ID3") or (
                len(audio) >= 2 and audio[0] == 0xff and audio[1] & 0xe0 == 0xe0
            )
            if len(audio) < 256 or not has_mp3_header:
                raise SystemExit("Azure did not return a usable MP3.")
            return audio
    except HTTPError as error:
        raise SystemExit(f"Azure Speech rejected synthesis (HTTP {error.code}).") from None


def get_calls(preview):
    files = json.loads((ROOT / "Cards/cards.json").read_text(encoding="utf-8"))
    if not files or not all(isinstance(file, str) and re.fullmatch(r"[^/\\]+\.webp", file) for file in files):
        raise SystemExit("cards.json must contain WebP filenames.")
    calls = {"start": "¡Corre y se va con…!"}
    for file in files:
        name = Path(file).stem
        if name in calls:
            raise SystemExit(f"Duplicate clip name: {name}")
        spoken_name = "El Violonchelo" if name == "El Violoncello" else name
        calls[name] = f"¡{spoken_name}!"
    return {name: phrase for name, phrase in calls.items() if not preview or name in PREVIEW}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--resource-group", required=True)
    parser.add_argument("--name", required=True, help="Existing Azure Speech F0 resource name")
    parser.add_argument("--output", required=True, type=Path, help="New directory for the MP3 files")
    parser.add_argument("--preview", action="store_true", help="Render only the opener and three sample calls")
    args = parser.parse_args()
    output = args.output.expanduser().absolute()
    if output.exists():
        parser.error("The output directory already exists.")
    if not output.parent.is_dir():
        parser.error("The output directory's parent must exist.")

    calls = get_calls(args.preview)
    endpoint, key = get_resource(args.resource_group, args.name)
    with tempfile.TemporaryDirectory(dir=output.parent) as staging:
        batch = Path(staging) / "clips"
        batch.mkdir()
        for index, (name, phrase) in enumerate(calls.items()):
            if index:
                # Stay below the F0 limit of 20 requests per minute.
                time.sleep(3.2)
            (batch / f"{name}.mp3").write_bytes(synthesize(endpoint, key, phrase))
        batch.rename(output)
    print(f"Generated {len(calls)} clips in {output}")


if __name__ == "__main__":
    main()
