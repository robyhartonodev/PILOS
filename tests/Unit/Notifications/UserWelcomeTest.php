<?php

namespace Tests\Unit\Notifications;

use App\Notifications\UserWelcome;
use App\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserWelcomeTest extends TestCase
{
    use RefreshDatabase;

    private $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = factory(User::class)->create([
            'firstname' => 'Max',
            'lastname'  => 'Mustermann',
            'email' => 'test@test.de',
            'locale' => 'de'
        ]);
    }

    public function testAddsCorrectDataToMail()
    {
        $date = Carbon::now();
        $userWelcome = new UserWelcome('1234', $date);

        $locale = Carbon::getLocale();
        Carbon::setLocale('de');
        $date = $date->isoFormat('LLLL');
        Carbon::setLocale($locale);

        $url = url('/reset_password?') . \Arr::query([
            'token' => '1234',
            'email' => 'test@test.de'
        ]);

        $message = $userWelcome->toMail($this->user);
        $this->assertEquals(trans('mail.user_welcome.subject', [], 'de'), $message->subject);
        $this->assertEquals(trans('mail.user_welcome.action', [], 'de'), $message->actionText);
        $this->assertEquals($url, $message->actionUrl);
        $this->assertEquals([
            trans('mail.user_welcome.description', [], 'de')
        ], $message->introLines);
        $this->assertEquals([
            trans('mail.user_welcome.expire', ['date' => $date], 'de')
        ], $message->outroLines);
    }
}
