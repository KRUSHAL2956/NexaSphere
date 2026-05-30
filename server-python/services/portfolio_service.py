import logging
from typing import Any, Dict

import httpx

logger = logging.getLogger(__name__)

LEETCODE_QUERY = """
query userProblemsSolved($username: String!) {
  matchedUser(username: $username) {
    submitStats {
      acSubmissionNum {
        difficulty
        count
      }
    }
    profile {
      ranking
    }
  }
}
"""


class PortfolioSyncService:
    """Stateless async service for fetching external platform metrics."""

    GITHUB_API = "https://api.github.com/users/{username}"
    LEETCODE_GRAPHQL = "https://leetcode.com/graphql"

    async def fetch_github_metrics(self, username: str) -> Dict[str, Any]:
        """Fetch public GitHub profile stats for a given username."""
        url = self.GITHUB_API.format(username=username)
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url, headers={"Accept": "application/vnd.github.v3+json"})
                resp.raise_for_status()
                data = resp.json()
                return {
                    "public_repos": data.get("public_repos", 0),
                    "followers": data.get("followers", 0),
                    "avatar_url": data.get("avatar_url", ""),
                    "bio": data.get("bio") or "",
                }
        except httpx.HTTPStatusError as e:
            logger.warning("GitHub API HTTP error for %s: %s", username, e.response.status_code)
        except httpx.RequestError as e:
            logger.warning("GitHub API request failed for %s: %s", username, e)
        except Exception as e:
            logger.exception("Unexpected GitHub API error for %s: %s", username, e)
        return {}

    async def fetch_leetcode_metrics(self, username: str) -> Dict[str, Any]:
        """Fetch public LeetCode stats via the unofficial GraphQL endpoint."""
        variables = {"username": username}
        payload = {"query": LEETCODE_QUERY, "variables": variables}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    self.LEETCODE_GRAPHQL,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                resp.raise_for_status()
                body = resp.json()
        except httpx.RequestError as e:
            logger.warning("LeetCode API request failed for %s: %s", username, e)
            return {}
        except Exception as e:
            logger.exception("Unexpected LeetCode API error for %s: %s", username, e)
            return {}

        matched = body.get("data", {}).get("matchedUser")
        if not matched:
            logger.info("LeetCode user not found: %s", username)
            return {}

        ac_list = (
            matched.get("submitStats", {})
            .get("acSubmissionNum", [])
        )
        counts: Dict[str, int] = {"all": 0, "easy": 0, "medium": 0, "hard": 0}
        for entry in ac_list:
            diff = (entry.get("difficulty") or "").lower()
            count = entry.get("count", 0) or 0
            if diff == "all":
                counts["all"] = count
            elif diff == "easy":
                counts["easy"] = count
            elif diff == "medium":
                counts["medium"] = count
            elif diff == "hard":
                counts["hard"] = count

        ranking = matched.get("profile", {}).get("ranking") or 0

        return {
            "totalSolved": counts["all"],
            "easySolved": counts["easy"],
            "mediumSolved": counts["medium"],
            "hardSolved": counts["hard"],
            "ranking": ranking,
        }
