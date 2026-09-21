#!/usr/bin/env python3
"""Seed sample notifications for testing."""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import db


def main():
    db.init_db()

    # Find users
    skid = db.get_user_by_username("skid") or db.get_user_by_username("alice")
    clasher = db.get_user_by_username("clasher")
    admin = db.get_user_by_username("admin")
    testuser = db.get_user_by_username("testuser")

    if not skid:
        print("ERROR: skid/alice not found")
        return
    if not clasher:
        print("ERROR: clasher not found")
        return

    # Find a repo owned by skid
    repos = db.list_repos_by_owner(skid["id"], include_private=True)
    if not repos:
        print("WARNING: skid has no repos. Creating one...")
        import git_ops
        git_ops.create_repo(skid["username"], "demo-repo")
        rid = db.create_repo(skid["id"], "demo-repo", "Demo repo for testing")
        repos = db.list_repos_by_owner(skid["id"], include_private=True)

    repo = repos[0]
    repo_id = repo["id"]

    # Find a post owned by skid
    posts = db.list_posts(author_id=skid["id"], limit=1)
    if not posts:
        print("WARNING: skid has no posts. Creating one...")
        pid, slug = db.create_post(
            skid["id"],
            title="My Test Post",
            body="This is a test post for notifications.",
            kind="short",
        )
        posts = db.list_posts(author_id=skid["id"], limit=1)
    post = posts[0]

    # Create notifications
    kinds = [
        ("clasher", "follow", None, "", "", None),
        ("clasher", "star", repo_id, "", "repo", repo_id),
        ("clasher", "watch", repo_id, "", "repo", repo_id),
        ("clasher", "fork", repo_id, "", "repo", repo_id),
        ("clasher", "issue", repo_id, "Bug in demo repo", "issue", 1),
        ("clasher", "comment", repo_id, "Nice work!", "issue", 1),
        ("clasher", "post_comment", None, post["slug"], "post", post["slug"]),
    ]

    if admin:
        kinds.append(("admin", "follow", None, "", "", None))
        kinds.append(("admin", "star", repo_id, "", "repo", repo_id))

    if testuser:
        kinds.append(("testuser", "follow", None, "", "", None))

    created = 0
    for actor_username, kind, r_id, detail, t_type, t_id in kinds:
        actor = db.get_user_by_username(actor_username)
        if not actor:
            continue
        try:
            db.create_notification(
                skid["id"],
                actor["id"],
                kind,
                repo_id=r_id,
                detail=detail,
                target_type=t_type,
                target_id=t_id,
            )
            created += 1
            print(f"  ✓ {actor_username} → {kind}")
        except Exception as e:
            print(f"  ✗ {actor_username} → {kind}: {e}")
        time.sleep(0.05)

    print(f"\nCreated {created} notifications for {skid['username']}")


if __name__ == "__main__":
    main()
