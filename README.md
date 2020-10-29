# Pixiv Container

**Prevent Pixiv from tracking your visits to other websites**

This is a fork of [Facebook Container](https://github.com/mozilla/contain-facebook)

Pixiv is an add-on you can install on Firefox to prevent Pixiv from tracking your activity on other websites, so you can continue to use Pixiv while protecting your privacy.

**Note:** To learn more about Containers in general, see [Firefox Multi-Account Containers](https://support.mozilla.org/kb/containers).

## How does Pixiv Container work?

The Add-on keeps Pixiv in a separate Container to prevent it from following your activity on other websites. When you first install the add-on, it signs you out of Pixiv and deletes the cookies that Pixiv uses to track you on other websites. 

Every time you visit Pixiv, it will open in its own container, separate from other websites you visit.  You can login to Pixiv within its container.  When browsing outside the container, Pixiv won’t be able to easily collect your browsing data and connect it to your Pixiv identity.

## How do I enable Pixiv Container?

We’ve made it easy to take steps to protect your privacy so you can go on with your day.

1. [Install Pixiv Container](https://addons.mozilla.org/firefox/addon/pixiv-container/). This will log you out of Pixiv and delete the cookies it’s been using to track you.
2. Open Pixiv and use it like you normally would.  Firefox will automatically switch to the Pixiv Container tab for you.
3. If you click on a link to a page outside of Pixiv or type in another website in the address bar, Firefox will load them outside of the Pixiv Container

## How does this affect Pixiv’s features?

Pixiv Containers prevents Pixiv from linking your activity on other websites to your Pixiv identity. Therefore, the following will not work:

### Logging in or creating accounts on other non-Pixiv websites using Pixiv

Websites that allow you to create an account or log in using Pixiv will generally not work properly besides pawoo.net, fanbox.cc, etc.

If there is a website that requires this or is closely integrated with Pixiv, please file an issue or make a pull request.

## How do I use Containers for other websites?

Good news! Containers aren’t just for Pixiv. You can use Containers to prevent websites from linking your identities across the Web by installing [Firefox Multi-Account Containers](https://addons.mozilla.org/firefox/addon/multi-account-containers/).

To learn more about how Mult-Account Containers work, see our support page at [Firefox Multi-Account Containers](https://addons.mozilla.org/firefox/addon/multi-account-containers/).
