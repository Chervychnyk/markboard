#!/usr/bin/env python3
"""F1 data for the Markboard race-weekend board, printed as JSON with the widget text ready to use.

  f1.py next                      the next race (or the one under way): schedule text, circuit, links
  f1.py standings                 drivers' (top 10) and constructors' standings after the last round
  f1.py session [NAME]            classification of a finished session of the current weekend
                                  (NAME: "Practice 1".."Practice 3", "Sprint Qualifying", "Sprint",
                                  "Qualifying", "Race"; default: the latest one that has ended)
  options: --year 2026  --meeting <OpenF1 meeting_key>  --top 10  --now 2026-10-31T23:00:00Z

Sources: Jolpica (Ergast) for the calendar and standings, OpenF1 for session results. Stdlib only.
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

JOLPICA = 'https://api.jolpi.ca/ergast/f1'
OPENF1 = 'https://api.openf1.org/v1'
SESSIONS = [('FirstPractice', 'Practice 1'), ('SecondPractice', 'Practice 2'), ('ThirdPractice', 'Practice 3'),
            ('SprintQualifying', 'Sprint Qualifying'), ('Sprint', 'Sprint'), ('Qualifying', 'Qualifying')]
SHORT = {'Practice 1': 'FP1', 'Practice 2': 'FP2', 'Practice 3': 'FP3', 'Sprint Qualifying': 'Sprint quali'}
TEAMS = {'Red Bull Racing': 'Red Bull', 'RB F1 Team': 'Racing Bulls', 'Alpine F1 Team': 'Alpine', 'Haas F1 Team': 'Haas', 'Cadillac F1 Team': 'Cadillac'}


def get(url, **q):
    """GET JSON. OpenF1 rate-limits bursts (429) and sometimes drops the connection: retry with a pause."""
    if q:
        url += '?' + urllib.parse.urlencode(q, safe='<>=')
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'markboard-f1'}), timeout=20) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429 and e.code < 500 or attempt == 3:
                raise
        except (urllib.error.URLError, ConnectionError, TimeoutError):
            if attempt == 3:
                raise
        time.sleep(2 * (attempt + 1))


def when(day, time='00:00:00Z'):
    return datetime.fromisoformat(f'{day}T{time}'.replace('Z', '+00:00'))


def lap(sec):
    if sec is None:
        return ''
    m, s = divmod(float(sec), 60)
    return f'{int(m)}:{s:06.3f}' if m else f'{s:.3f}'


def last(v):
    """OpenF1 gives qualifying times and gaps as [Q1, Q2, Q3]; the furthest part reached counts."""
    if isinstance(v, list):
        v = [x for x in v if x is not None]
        return v[-1] if v else None
    return v


def races(year):
    return get(f'{JOLPICA}/{year}/races.json', limit=100)['MRData']['RaceTable']['Races']


def cmd_next(a, now):
    # The race weekend under way or next: the first race not finished more than 3 hours ago.
    for r in races(a.year):
        if when(r['date'], r.get('time', '00:00:00Z')).timestamp() + 3 * 3600 > now.timestamp():
            break
    else:
        return {'error': f'No races left in {a.year}'}
    rows = [(label, when(r[k]['date'], r[k].get('time', '00:00:00Z'))) for k, label in SESSIONS if k in r]
    rows.append(('Race', when(r['date'], r.get('time', '00:00:00Z'))))
    rows.sort(key=lambda x: x[1])
    loc = r['Circuit']['Location']
    return {
        'race': r['raceName'], 'round': int(r['round']), 'season': int(r['season']),
        'circuit': r['Circuit']['circuitName'], 'locality': loc['locality'], 'country': loc['country'],
        'lat': loc['lat'], 'long': loc['long'], 'sprint': 'Sprint' in r,
        'schedule_text': '\n'.join(f'{label} | {t.strftime("%Y-%m-%dT%H:%M:%SZ")}' for label, t in rows),
        'links': {
            'wikipedia': r['url'], 'circuit_wikipedia': r['Circuit']['url'],
            'windy': f'https://www.windy.com/{float(loc["lat"]):.3f}/{float(loc["long"]):.3f}',
        },
    }


def cmd_standings(a, _now):
    d = get(f'{JOLPICA}/{a.year}/driverstandings.json')['MRData']['StandingsTable']['StandingsLists']
    c = get(f'{JOLPICA}/{a.year}/constructorstandings.json')['MRData']['StandingsTable']['StandingsLists']
    if not d:
        return {'error': f'No standings for {a.year} yet'}
    rnd = int(d[0]['round'])
    name = next((r['raceName'] for r in races(a.year) if int(r['round']) == rnd), f'round {rnd}')
    drivers = d[0]['DriverStandings']
    team = lambda x: TEAMS.get(x, x)
    return {
        'round': rnd, 'after': name,
        'drivers_text': 'Pos | Driver | Team | Wins | Pts\n' + '\n'.join(
            f'{s["position"]} | {s["Driver"]["familyName"]} | {team(s["Constructors"][0]["name"])} | {s["wins"]} | {s["points"]}'
            for s in drivers[:a.top]),
        'drivers_note': f'After round {rnd} ({name.replace(" Grand Prix", " GP")}) · top {min(a.top, len(drivers))} of {len(drivers)}',
        'constructors_text': 'Pos | Team | Wins | Pts\n' + '\n'.join(
            f'{s["position"]} | {team(s["Constructor"]["name"])} | {s["wins"]} | {s["points"]}' for s in c[0]['ConstructorStandings']),
        'constructors_note': f'After round {rnd} ({name.replace(" Grand Prix", " GP")})',
    }


def cmd_session(a, now):
    meeting = a.meeting or 'latest'
    sessions = get(f'{OPENF1}/sessions', meeting_key=meeting)
    if not sessions:
        return {'error': f'No sessions for meeting {meeting}'}
    ended = [s for s in sessions if datetime.fromisoformat(s['date_end']) <= now]
    if a.name:
        pick = next((s for s in sessions if s['session_name'].lower() == a.name.lower()), None)
        if not pick:
            return {'error': f'No "{a.name}" in this meeting. Sessions: ' + ', '.join(s['session_name'] for s in sessions)}
        if pick not in ended:
            return {'error': f'{pick["session_name"]} has not ended yet (ends {pick["date_end"]})'}
    elif ended:
        pick = ended[-1]
    else:
        return {'error': 'No session of this meeting has ended yet', 'meeting': sessions[0]['location'],
                'first_session': sessions[0]['session_name'], 'starts': sessions[0]['date_start']}
    results = get(f'{OPENF1}/session_result', session_key=pick['session_key'])
    if not results:
        return {'error': f'{pick["session_name"]} has ended but has no classification yet; try again in a few minutes'}
    people = {d['driver_number']: d for d in get(f'{OPENF1}/drivers', session_key=pick['session_key'])}
    name = pick['session_name']
    race = name in ('Race', 'Sprint')
    rows = []
    for r in sorted(results, key=lambda r: (r.get('position') is None, r.get('position') or 99))[:a.top]:
        p = people.get(r['driver_number'], {})
        out = next((k.upper() for k in ('dsq', 'dns', 'dnf') if r.get(k)), None)
        gap = last(r.get('gap_to_leader'))
        if race:
            time = out or ('' if r.get('position') == 1 else (gap if isinstance(gap, str) else f'+{gap:.3f}' if gap else ''))
        else:
            best = last(r.get('duration'))
            time = out or (lap(best) if r.get('position') == 1 or not gap else f'+{gap:.3f}')
        rows.append(f'{r.get("position") or "–"} | {p.get("last_name", r["driver_number"])} | {TEAMS.get(p.get("team_name"), p.get("team_name", ""))} | {time} | {r.get("number_of_laps", "")}')
    label = SHORT.get(name, name)
    return {
        'session': name, 'location': pick['location'], 'country': pick['country_name'], 'ended': pick['date_end'],
        'key': 'qualifying' if 'Qualifying' in name else 'race' if race else 'practice',
        'title': f'{label} · {pick["location"]}',
        'text': f'Pos | Driver | Team | {"Time/Gap" if not race else "Gap"} | Laps\n' + '\n'.join(rows),
        'note': f'{name}, {pick["location"]} · top {len(rows)} · times are best laps, gaps to P1' if not race
                else f'{name}, {pick["location"]} · top {len(rows)}',
    }


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('command', choices=['next', 'standings', 'session'])
    p.add_argument('name', nargs='?')
    p.add_argument('--year', type=int, default=datetime.now(timezone.utc).year)
    p.add_argument('--meeting')
    p.add_argument('--top', type=int, default=10)
    p.add_argument('--now', help='pretend it is this UTC time (for testing)')
    a = p.parse_args()
    now = datetime.fromisoformat(a.now.replace('Z', '+00:00')) if a.now else datetime.now(timezone.utc)
    try:
        out = {'next': cmd_next, 'standings': cmd_standings, 'session': cmd_session}[a.command](a, now)
    except Exception as e:  # network or API trouble: say so in the same JSON shape
        out = {'error': f'{type(e).__name__}: {e}'}
    json.dump(out, sys.stdout, indent=2, ensure_ascii=False)
    print()
    sys.exit(1 if 'error' in out else 0)


if __name__ == '__main__':
    main()
